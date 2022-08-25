import type {Crumb} from 'sentry/types/breadcrumbs';
import {CodecovRepo, ReplayCodecovAttachment} from 'sentry/utils/replays/codecovRepo';
import {
  breadcrumbFactory,
  replayTimestamps,
  rrwebEventListFactory,
  spansFactory,
} from 'sentry/utils/replays/replayDataUtils';
import type {WebpackChunk} from 'sentry/views/replays/detail/unusedModules/utils';
import type {
  MemorySpanType,
  RecordingEvent,
  ReplayCrumb,
  ReplayError,
  ReplayRecord,
  ReplaySpan,
} from 'sentry/views/replays/types';

import mockChunkData from '../../../../mock_chunk_data.json';

interface ReplayReaderParams {
  breadcrumbs: ReplayCrumb[] | undefined;
  codecov: ReplayCodecovAttachment[] | undefined;

  errors: ReplayError[] | undefined;

  /**
   * The root Replay event, created at the start of the browser session.
   */
  replayRecord: ReplayRecord | undefined;

  /**
   * The captured data from rrweb.
   * Saved as N attachments that belong to the root Replay event.
   */
  rrwebEvents: RecordingEvent[] | undefined;

  spans: ReplaySpan[] | undefined;
}

type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

export default class ReplayReader {
  static factory({
    breadcrumbs,
    replayRecord,
    errors,
    rrwebEvents,
    spans,
    codecov,
  }: ReplayReaderParams) {
    if (!breadcrumbs || !replayRecord || !rrwebEvents || !spans || !errors || !codecov) {
      return null;
    }

    return new ReplayReader({
      breadcrumbs,
      replayRecord,
      errors,
      rrwebEvents,
      spans,
      codecov,
    });
  }

  private constructor({
    breadcrumbs,
    replayRecord,
    errors,
    rrwebEvents,
    spans,
    codecov,
  }: RequiredNotNull<ReplayReaderParams>) {
    // TODO(replays): We should get correct timestamps from the backend instead
    // of having to fix them up here.
    const {startTimestampMs, endTimestampMs} = replayTimestamps(
      rrwebEvents,
      breadcrumbs,
      spans
    );
    replayRecord.startedAt = new Date(startTimestampMs);
    replayRecord.finishedAt = new Date(endTimestampMs);

    this.spans = spansFactory(spans);
    this.breadcrumbs = breadcrumbFactory(replayRecord, errors, breadcrumbs, this.spans);

    this.rrwebEvents = rrwebEventListFactory(replayRecord, rrwebEvents);

    this.replayRecord = replayRecord;
    this.codecovRepo = new CodecovRepo(codecov);
  }

  private replayRecord: ReplayRecord;
  private rrwebEvents: RecordingEvent[];
  private breadcrumbs: Crumb[];
  private spans: ReplaySpan[];
  private codecovRepo: CodecovRepo;

  /**
   * @returns Duration of Replay (milliseonds)
   */
  getDurationMs = () => {
    return this.replayRecord.duration * 1000;
  };

  getReplay = () => {
    return this.replayRecord;
  };

  getRRWebEvents = () => {
    return this.rrwebEvents;
  };

  getRawCrumbs = () => {
    return this.breadcrumbs;
  };

  getRawSpans = () => {
    return this.spans;
  };

  getCodecovRepo = () => {
    return this.codecovRepo;
  };

  isMemorySpan = (span: ReplaySpan): span is MemorySpanType => {
    return span.op === 'memory';
  };

  isNetworkSpan = (span: ReplaySpan) => {
    return !this.isMemorySpan(span) && !span.op.includes('paint');
  };

  getWebpackStatsFile() {
    return mockChunkData as WebpackChunk[];
  }
}
