import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import {Actor} from 'sentry/types';

type Props = {
  owners: Actor[];
} & BaseAvatar['props'] &
  Omit<ActorAvatar['props'], 'actor' | 'hasTooltip'>;

// Constrain the number of visible suggestions
const MAX_SUGGESTIONS = 5;

const SuggestedAvatarStack = ({owners, tooltip, tooltipOptions, ...props}: Props) => {
  const backgroundAvatarProps = {
    ...props,
    round: owners[0].type === 'user',
    suggested: true,
  };
  const numAvatars = Math.min(owners.length, MAX_SUGGESTIONS);
  return (
    <AvatarStack data-test-id="suggested-avatar-stack">
      {[...Array(numAvatars - 1)].map((_, i) => (
        <BackgroundAvatar
          {...backgroundAvatarProps}
          key={i}
          type="background"
          index={i}
          hasTooltip={false}
        />
      ))}
      <Avatar
        {...props}
        suggested
        actor={owners[0]}
        index={numAvatars - 1}
        tooltip={tooltip}
        tooltipOptions={{...tooltipOptions, skipWrapper: true}}
      />
    </AvatarStack>
  );
};

const AvatarStack = styled('div')`
  display: flex;
  align-content: center;
  flex-direction: row-reverse;
`;

const translateStyles = (props: {index: number}) => css`
  transform: translateX(${60 * props.index}%);
`;

const Avatar = styled(ActorAvatar)<{index: number}>`
  ${translateStyles}
`;

const BackgroundAvatar = styled(BaseAvatar)<{index: number}>`
  ${translateStyles}
`;

export default SuggestedAvatarStack;
