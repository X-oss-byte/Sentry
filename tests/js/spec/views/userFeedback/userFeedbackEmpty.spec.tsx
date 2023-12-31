import {reactHooks, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {UserFeedbackEmpty} from 'sentry/views/userFeedback/userFeedbackEmpty';

describe('UserFeedbackEmpty', function () {
  const project = TestStubs.Project({id: '1'});
  const projectWithReports = TestStubs.Project({id: '2', hasUserReports: true});
  const projectWithoutReports = TestStubs.Project({id: '3'});
  const organization = TestStubs.Organization();

  it('renders empty', function () {
    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty />)
      </OrganizationContext.Provider>
    );
  });

  it('renders landing for project with no user feedback', function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData([project]));

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for project with any user feedback', function () {
    reactHooks.act(() => void ProjectsStore.loadInitialData([projectWithReports]));

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for projects with any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders warning for project query with user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty projectIds={[projectWithReports.id]} />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for project query without any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty projectIds={[project.id]} />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });

  it('renders warning for multi project query with any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithReports])
    );

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty projectIds={[project.id, projectWithReports.id]} />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByText('Sorry, no user reports match your filters.')
    ).toBeInTheDocument();
  });

  it('renders landing for multi project query without any user feedback', function () {
    reactHooks.act(
      () => void ProjectsStore.loadInitialData([project, projectWithoutReports])
    );

    render(
      <OrganizationContext.Provider value={organization}>
        <UserFeedbackEmpty projectIds={[project.id, projectWithoutReports.id]} />)
      </OrganizationContext.Provider>
    );

    expect(
      screen.getByRole('heading', {name: 'What do users think?'})
    ).toBeInTheDocument();
  });
});
