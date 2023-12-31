import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {SERVER_SIDE_SAMPLING_DOC_LINK} from 'sentry/views/settings/project/server-side-sampling/utils';

import {
  getMockData,
  mockedProjects,
  mockedSamplingDistribution,
  mockedSamplingSdkVersions,
  specificRule,
  TestComponent,
  uniformRule,
} from './utils';

describe('Server-side Sampling', function () {
  let distributionMock: ReturnType<typeof MockApiClient.addMockResponse> | undefined =
    undefined;
  let sdkVersionsMock: ReturnType<typeof MockApiClient.addMockResponse> | undefined =
    undefined;

  beforeEach(function () {
    distributionMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/dynamic-sampling/distribution/',
      method: 'GET',
      body: mockedSamplingDistribution,
    });

    sdkVersionsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dynamic-sampling/sdk-versions/',
      method: 'GET',
      body: mockedSamplingSdkVersions,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders onboarding promo', function () {
    const {router, organization, project} = getMockData();

    const {container} = render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    expect(
      screen.getByRole('heading', {name: 'Server-side Sampling'})
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Server-side sampling lets you control what transactions Sentry retains by setting sample rules and rates so you see more of the transactions you want to explore further in Sentry – and less of the ones you don’t – without re-configuring the Sentry SDK and redeploying anything.'
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('heading', {name: 'Set sample rules for your project'})
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        'Because every project is different – some need more events from high converting pages, critical API endpoints, or just want to focus on latency issues from the latest release – set multiple sample rules with different sample rates per project so you can keep what you need and drop what you don’t.'
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(screen.getByRole('button', {name: 'Start Setup'})).toBeInTheDocument();

    expect(container).toSnapshot();
  });

  it('renders rules panel', function () {
    const {router, organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [{...uniformRule, sampleRate: 1}],
          },
        }),
      ],
    });

    const {container} = render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    // Rule Panel Header
    expect(screen.getByText('Operator')).toBeInTheDocument();
    expect(screen.getByText('Condition')).toBeInTheDocument();
    expect(screen.getByText('Rate')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Rule Panel Content
    expect(screen.getAllByTestId('sampling-rule').length).toBe(1);
    expect(screen.queryByLabelText('Drag Rule')).not.toBeInTheDocument();
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('If');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('All');
    expect(screen.getByTestId('sampling-rule')).toHaveTextContent('100%');
    expect(screen.getByLabelText('Activate Rule')).toBeInTheDocument();
    expect(screen.getByLabelText('Actions')).toBeInTheDocument();

    // Rule Panel Footer
    expect(screen.getByText('Add Rule')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Read Docs'})).toHaveAttribute(
      'href',
      SERVER_SIDE_SAMPLING_DOC_LINK
    );

    expect(container).toSnapshot();
  });

  it('does not let you delete the base rule', function () {
    const {router, organization, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 0.2,
                type: 'trace',
                active: false,
                condition: {
                  op: 'and',
                  inner: [
                    {
                      op: 'glob',
                      name: 'trace.release',
                      value: ['1.2.3'],
                    },
                  ],
                },
                id: 2,
              },
              {
                sampleRate: 0.2,
                type: 'trace',
                active: false,
                condition: {
                  op: 'and',
                  inner: [],
                },
                id: 1,
              },
            ],
            next_id: 3,
          },
        }),
      ],
    });

    render(
      <TestComponent router={router} organization={organization} project={project} />
    );

    const deleteButtons = screen.getAllByLabelText('Delete');
    expect(deleteButtons[0]).not.toHaveAttribute('disabled'); // eslint-disable-line jest-dom/prefer-enabled-disabled
    expect(deleteButtons[1]).toHaveAttribute('disabled'); // eslint-disable-line jest-dom/prefer-enabled-disabled
  });

  it('display "update sdk versions" alert and open "recommended next step" modal', async function () {
    const {organization, projects, router} = getMockData({
      projects: mockedProjects,
    });

    render(
      <TestComponent
        organization={organization}
        project={projects[2]}
        router={router}
        withModal
      />
    );

    expect(distributionMock).toHaveBeenCalled();

    await waitFor(() => {
      expect(sdkVersionsMock).toHaveBeenCalled();
    });

    const recommendedSdkUpgradesAlert = screen.getByTestId(
      'recommended-sdk-upgrades-alert'
    );

    expect(
      within(recommendedSdkUpgradesAlert).getByText(
        'To ensure you are properly monitoring the performance of all your other services, we require you update to the latest version of the following SDK(s):'
      )
    ).toBeInTheDocument();

    expect(
      within(recommendedSdkUpgradesAlert).getByRole('link', {
        name: mockedProjects[1].slug,
      })
    ).toHaveAttribute(
      'href',
      `/organizations/org-slug/projects/sentry/?project=${mockedProjects[1].id}`
    );

    // Open Modal
    userEvent.click(
      within(recommendedSdkUpgradesAlert).getByRole('button', {
        name: 'Learn More',
      })
    );

    expect(await screen.findByRole('heading', {name: 'Next steps'})).toBeInTheDocument();
  });

  it('Open specific conditions modal', async function () {
    const {router, project, organization} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [
              {
                sampleRate: 1,
                type: 'trace',
                active: false,
                condition: {
                  op: 'and',
                  inner: [],
                },
                id: 1,
              },
            ],
          },
        }),
      ],
    });

    render(
      <TestComponent
        organization={organization}
        project={project}
        router={router}
        withModal
      />
    );

    // Open Modal
    userEvent.click(screen.getByLabelText('Add Rule'));

    expect(await screen.findByRole('heading', {name: 'Add Rule'})).toBeInTheDocument();
  });

  it('does not let user add without permissions', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
      access: [],
    });

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    expect(screen.getByRole('button', {name: 'Add Rule'})).toBeDisabled();
    userEvent.hover(screen.getByText('Add Rule'));
    expect(
      await screen.findByText("You don't have permission to add a rule")
    ).toBeInTheDocument();

    expect(distributionMock).not.toHaveBeenCalled();
    expect(sdkVersionsMock).not.toHaveBeenCalled();
  });

  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('does not let the user activate a rule if sdk updates exists', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    render(
      <TestComponent organization={organization} project={project} router={router} />
    );

    expect(screen.getByRole('checkbox', {name: 'Activate Rule'})).toBeDisabled();

    userEvent.hover(screen.getByLabelText('Activate Rule'));

    expect(
      await screen.findByText(
        'To enable the rule, the recommended sdk version have to be updated'
      )
    ).toBeInTheDocument();
  });

  it('open uniform rate modal when editing a uniform rule', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [uniformRule],
          },
        }),
      ],
    });

    render(
      <TestComponent
        organization={organization}
        project={project}
        router={router}
        withModal
      />
    );

    userEvent.click(screen.getByLabelText('Actions'));

    // Open Modal
    userEvent.click(screen.getByLabelText('Edit'));

    expect(
      await screen.findByRole('heading', {
        name: 'Define a global sample rate',
      })
    ).toBeInTheDocument();
  });

  it('does not let user reorder uniform rule', async function () {
    const {organization, router, project} = getMockData({
      projects: [
        TestStubs.Project({
          dynamicSampling: {
            rules: [specificRule, uniformRule],
          },
        }),
      ],
    });

    render(
      <TestComponent
        organization={organization}
        project={project}
        router={router}
        withModal
      />
    );

    const samplingUniformRule = screen.getAllByTestId('sampling-rule')[1];

    expect(
      within(samplingUniformRule).getByRole('button', {name: 'Drag Rule'})
    ).toHaveAttribute('aria-disabled', 'true');

    userEvent.hover(within(samplingUniformRule).getByLabelText('Drag Rule'));

    expect(
      await screen.findByText('Uniform rules cannot be reordered')
    ).toBeInTheDocument();
  });
});
