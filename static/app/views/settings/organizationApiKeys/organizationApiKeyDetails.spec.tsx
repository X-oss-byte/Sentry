import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import OrganizationApiKeyDetails from 'sentry/views/settings/organizationApiKeys/organizationApiKeyDetails';

describe('OrganizationApiKeyDetails', function () {
  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/api-keys/1/',
      method: 'GET',
      body: TestStubs.DeprecatedApiKey(),
    });
  });

  it('renders', function () {
    const {organization, routerContext, routerProps} = initializeOrg();
    const wrapper = render(
      <OrganizationApiKeyDetails {...routerProps} params={{apiKey: '1'}} />,
      {
        context: routerContext,
        organization,
      }
    );

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(wrapper.container).toSnapshot();
  });
});