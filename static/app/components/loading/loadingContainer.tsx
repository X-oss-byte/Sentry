import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import theme from 'sentry/utils/theme';

export type LoadingContainerProps = {
  children?: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  isReloading?: boolean;
  maskBackgroundColor?: string;
};

type MaskProps = {
  isReloading: boolean;
  maskBackgroundColor: string;
};

export default function LoadingContainer({
  isLoading = false,
  isReloading = false,
  maskBackgroundColor = theme.white,
  className,
  children,
}: LoadingContainerProps) {
  const isLoadingOrReloading = isLoading || isReloading;
  return (
    <Container className={className}>
      {isLoadingOrReloading && (
        <div>
          <LoadingMask
            isReloading={isReloading}
            maskBackgroundColor={maskBackgroundColor}
          />
          <Indicator />
        </div>
      )}
      {children}
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
`;

const LoadingMask = styled('div')<MaskProps>`
  position: absolute;
  z-index: 1;
  background-color: ${p => p.maskBackgroundColor};
  width: 100%;
  height: 100%;
  opacity: ${p => (p.isReloading ? '0.6' : '1')};
`;

const Indicator = styled(LoadingIndicator)`
  position: absolute;
  z-index: 3;
  width: 100%;
`;
