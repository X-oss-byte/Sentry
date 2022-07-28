import {Component} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  openInviteMembersModal,
  openTeamAccessRequestModal,
} from 'sentry/actionCreators/modal';
import {joinTeam, leaveTeam} from 'sentry/actionCreators/teams';
import {Client} from 'sentry/api';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import DropdownButton from 'sentry/components/dropdownButton';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Panel, PanelHeader} from 'sentry/components/panels';
import {IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Config, Member, Organization, TeamMember} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withConfig from 'sentry/utils/withConfig';
import withOrganization from 'sentry/utils/withOrganization';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

import TeamMembersRow from './teamMembersRow';

type RouteParams = {
  orgId: string;
  teamId: string;
};

type Props = {
  api: Client;
  config: Config;
  organization: Organization;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  dropdownBusy: boolean;
  error: boolean;
  loading: boolean;
  orgMemberList: Member[];
  teamMemberList: TeamMember[];
};

class TeamMembers extends Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    dropdownBusy: false,
    teamMemberList: [],
    orgMemberList: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const params = this.props.params;
    if (
      nextProps.params.teamId !== params.teamId ||
      nextProps.params.orgId !== params.orgId
    ) {
      this.setState(
        {
          loading: true,
          error: false,
        },
        this.fetchData
      );
    }
  }

  debouncedFetchMembersRequest = debounce(
    (query: string) =>
      this.setState({dropdownBusy: true}, () => this.fetchMembersRequest(query)),
    200
  );

  fetchMembersRequest = async (query: string) => {
    const {params, api} = this.props;
    const {orgId} = params;

    try {
      const data = await api.requestPromise(`/organizations/${orgId}/members/`, {
        query: {query},
      });
      this.setState({
        orgMemberList: data,
        dropdownBusy: false,
      });
    } catch (_err) {
      addErrorMessage(t('Unable to load organization members.'), {
        duration: 2000,
      });

      this.setState({
        dropdownBusy: false,
      });
    }
  };

  fetchData = async () => {
    const {api, params} = this.props;

    try {
      const data = await api.requestPromise(
        `/teams/${params.orgId}/${params.teamId}/members/`
      );
      this.setState({
        teamMemberList: data,
        loading: false,
        error: false,
      });
    } catch (err) {
      this.setState({
        loading: false,
        error: true,
      });
    }

    this.fetchMembersRequest('');
  };

  addTeamMember = (selection: Item) => {
    const {params} = this.props;

    this.setState({loading: true});

    // Reset members list after adding member to team
    this.debouncedFetchMembersRequest('');

    joinTeam(
      this.props.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: selection.value,
      },
      {
        success: () => {
          const orgMember = this.state.orgMemberList.find(
            member => member.id === selection.value
          );
          if (orgMember === undefined) {
            return;
          }
          this.setState({
            loading: false,
            error: false,
            teamMemberList: this.state.teamMemberList.concat([orgMember as TeamMember]),
          });
          addSuccessMessage(t('Successfully added member to team.'));
        },
        error: () => {
          this.setState({
            loading: false,
          });
          addErrorMessage(t('Unable to add team member.'));
        },
      }
    );
  };

  removeTeamMember = (member: Member) => {
    const {params} = this.props;
    leaveTeam(
      this.props.api,
      {
        orgId: params.orgId,
        teamId: params.teamId,
        memberId: member.id,
      },
      {
        success: () => {
          this.setState({
            teamMemberList: this.state.teamMemberList.filter(m => m.id !== member.id),
          });
          addSuccessMessage(t('Successfully removed member from team.'));
        },
        error: () =>
          addErrorMessage(
            t('There was an error while trying to remove a member from the team.')
          ),
      }
    );
  };

  updateTeamMemberRole = (member: Member, newRole: string) => {
    const {orgId, teamId} = this.props.params;
    const endpoint = `/organizations/${orgId}/members/${member.id}/teams/${teamId}/`;

    this.props.api.request(endpoint, {
      method: 'PUT',
      data: {teamRole: newRole},
      success: data => {
        const teamMemberList: any = [...this.state.teamMemberList];
        const i = teamMemberList.findIndex(m => m.id === member.id);
        teamMemberList[i] = {
          ...member,
          teamRole: data.teamRole,
        };
        this.setState({teamMemberList});
        addSuccessMessage(t('Successfully changed role for team member.'));
      },
      error: () => {
        addErrorMessage(
          t('There was an error while trying to change the roles for a team member.')
        );
      },
    });
  };

  /**
   * We perform an API request to support orgs with > 100 members (since that's the max API returns)
   *
   * @param {Event} e React Event when member filter input changes
   */
  handleMemberFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    this.setState({dropdownBusy: true});
    this.debouncedFetchMembersRequest(e.target.value);
  };

  renderDropdown(hasWriteAccess: boolean) {
    const {organization, params} = this.props;
    const existingMembers = new Set(this.state.teamMemberList.map(member => member.id));

    // members can add other members to a team if the `Open Membership` setting is enabled
    // otherwise, `org:write` or `team:admin` permissions are required
    const hasOpenMembership = !!organization?.openMembership;
    const canAddMembers = hasOpenMembership || hasWriteAccess;

    const items = (this.state.orgMemberList || [])
      .filter(m => !existingMembers.has(m.id))
      .map(m => ({
        searchKey: `${m.name} ${m.email}`,
        value: m.id,
        label: (
          <StyledUserListElement>
            <StyledAvatar user={m} size={24} className="avatar" />
            <StyledNameOrEmail>{m.name || m.email}</StyledNameOrEmail>
          </StyledUserListElement>
        ),
      }));

    const menuHeader = (
      <StyledMembersLabel>
        {t('Members')}
        <StyledCreateMemberLink
          to=""
          onClick={() => openInviteMembersModal({source: 'teams'})}
          data-test-id="invite-member"
        >
          {t('Invite Member')}
        </StyledCreateMemberLink>
      </StyledMembersLabel>
    );

    return (
      <DropdownAutoComplete
        items={items}
        alignMenu="right"
        onSelect={
          canAddMembers
            ? this.addTeamMember
            : selection =>
                openTeamAccessRequestModal({
                  teamId: params.teamId,
                  orgId: params.orgId,
                  memberId: selection.value,
                })
        }
        menuHeader={menuHeader}
        emptyMessage={t('No members')}
        onChange={this.handleMemberFilterChange}
        busy={this.state.dropdownBusy}
        onClose={() => this.debouncedFetchMembersRequest('')}
      >
        {({isOpen}) => (
          <DropdownButton isOpen={isOpen} size="xs" data-test-id="add-member">
            {t('Add Member')}
          </DropdownButton>
        )}
      </DropdownAutoComplete>
    );
  }

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }

    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const {organization, config} = this.props;
    const {access} = organization;
    const hasWriteAccess = access.includes('org:write') || access.includes('team:admin');

    return (
      <Panel>
        <PanelHeader hasButtons>
          <div>{t('Members')}</div>
          <div style={{textTransform: 'none'}}>{this.renderDropdown(hasWriteAccess)}</div>
        </PanelHeader>
        {this.state.teamMemberList.length ? (
          this.state.teamMemberList.map(member => {
            return (
              <TeamMembersRow
                key={member.id}
                hasWriteAccess={hasWriteAccess}
                member={member}
                organization={organization}
                removeMember={this.removeTeamMember}
                updateMemberRole={this.updateTeamMemberRole}
                user={config.user}
              />
            );
          })
        ) : (
          <EmptyMessage icon={<IconUser size="xl" />} size="large">
            {t('This team has no members')}
          </EmptyMessage>
        )}
      </Panel>
    );
  }
}

const StyledUserListElement = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(0.5)};
  align-items: center;
`;

const StyledNameOrEmail = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  ${p => p.theme.overflowEllipsis};
`;

const StyledAvatar = styled(props => <UserAvatar {...props} />)`
  min-width: 1.75em;
  min-height: 1.75em;
  width: 1.5em;
  height: 1.5em;
`;

const StyledMembersLabel = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  padding: ${space(1)} 0;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
`;

const StyledCreateMemberLink = styled(Link)`
  text-transform: none;
`;

export default withConfig(withApi(withOrganization(TeamMembers)));
