import abc
from typing import Any, Mapping, Sequence, Tuple
from unittest.mock import MagicMock, Mock, patch

import pytest

from sentry.issues.grouptype import PerformanceNPlusOneGroupType
from sentry.testutils import TestCase
from sentry.testutils.cases import BaseTestCase
from sentry.testutils.performance_issues.store_transaction import PerfIssueTransactionTestMixin
from sentry.testutils.silo import region_silo_test
from sentry.utils.sdk_crashes.cocoa_sdk_crash_detector import CocoaSDKCrashDetector
from sentry.utils.sdk_crashes.sdk_crash_detection import (
    SDKCrashDetection,
    SDKCrashReporter,
    sdk_crash_detection,
)
from tests.sentry.utils.sdk_crashes.test_fixture import (
    IN_APP_FRAME,
    get_crash_event,
    get_crash_event_with_frames,
    get_sentry_frame,
)


class BaseSDKCrashDetectionMixin(BaseTestCase, metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def create_event(self, data, project_id, assert_no_errors=True):
        pass

    def execute_test(self, event_data, should_be_reported, mock_sdk_crash_reporter):
        event = self.create_event(
            data=event_data,
            project_id=self.project.id,
        )

        sdk_crash_detection.detect_sdk_crash(event=event)

        if should_be_reported:
            mock_sdk_crash_reporter.report.assert_called_once()
        else:
            mock_sdk_crash_reporter.report.assert_not_called()


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKTestMixin(BaseSDKCrashDetectionMixin):
    def test_unhandled_is_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(), True, mock_sdk_crash_reporter)

    def test_handled_is_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(handled=True), False, mock_sdk_crash_reporter)

    def test_wrong_function_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(function="Senry"), False, mock_sdk_crash_reporter)

    def test_wrong_platform_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(platform="coco"), False, mock_sdk_crash_reporter)

    def test_no_exception_not_detected(self, mock_sdk_crash_reporter):
        self.execute_test(get_crash_event(exception=[]), False, mock_sdk_crash_reporter)


@patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
class CococaSDKFunctionTestMixin(BaseSDKCrashDetectionMixin):
    def test_hub_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SentryHub getScope]"), True, mock_sdk_crash_reporter
        )

    def test_sentrycrash_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="sentrycrashdl_getBinaryImage"), True, mock_sdk_crash_reporter
        )

    def test_sentryisgreat_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[sentryisgreat]"), True, mock_sdk_crash_reporter
        )

    def test_sentryswizzle_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(
                function="__47-[SentryBreadcrumbTracker swizzleViewDidAppear]_block_invoke_2"
            ),
            True,
            mock_sdk_crash_reporter,
        )

    def test_sentrycrash_crash_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SentryCrash crash]"),
            True,
            mock_sdk_crash_reporter,
        )

    def test_senryhub_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SenryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    def test_senryhub_no_brackets_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-SentryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    def test_somesentryhub_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="-[SomeSentryHub getScope]"),
            False,
            mock_sdk_crash_reporter,
        )

    # This method is used for testing, so we can ignore it.
    def test_sentrycrash_not_reported(self, mock_sdk_crash_reporter):
        self.execute_test(
            get_crash_event(function="+[SentrySDK crash]"),
            False,
            mock_sdk_crash_reporter,
        )


class PerformanceEventTestMixin(BaseSDKCrashDetectionMixin, PerfIssueTransactionTestMixin):
    @patch("sentry.utils.sdk_crashes.sdk_crash_detection.sdk_crash_detection.sdk_crash_reporter")
    def test_performance_event_not_detected(self, mock_sdk_crash_reporter):

        fingerprint = "some_group"
        fingerprint = f"{PerformanceNPlusOneGroupType.type_id}-{fingerprint}"
        event = self.store_transaction(
            project_id=self.project.id,
            user_id="hi",
            fingerprint=[fingerprint],
        )

        sdk_crash_detection.detect_sdk_crash(event=event)

        mock_sdk_crash_reporter.report.assert_not_called()


@region_silo_test
class SDKCrashDetectionTest(
    TestCase,
    CococaSDKTestMixin,
    CococaSDKFunctionTestMixin,
    PerformanceEventTestMixin,
):
    def create_event(self, data, project_id, assert_no_errors=True):
        return self.store_event(data=data, project_id=project_id, assert_no_errors=assert_no_errors)


@pytest.mark.parametrize(
    "filename,should_be_reported",
    [
        ("SentryCrashMonitor_CPPException.cpp", True),
        ("SentryMonitor_CPPException.cpp", True),
        ("SentrMonitor_CPPException.cpp", False),
    ],
)
def test_report_cocoa_sdk_crash_filename(filename, should_be_reported):
    event = get_crash_event_with_frames(
        frames=[
            {
                "function": "__handleUncaughtException",
                "symbol": "__handleUncaughtException",
                "package": "CoreFoundation",
                "in_app": False,
            },
            {
                "function": "_objc_terminate",
                "symbol": "_ZL15_objc_terminatev",
                "package": "libobjc.A.dylib",
                "in_app": False,
            },
            {
                "function": "CPPExceptionTerminate",
                "raw_function": "CPPExceptionTerminate()",
                "filename": filename,
                "symbol": "_ZL21CPPExceptionTerminatev",
                "package": "MainApp",
                "in_app": False,
            },
            {
                "function": "std::__terminate",
                "symbol": "_ZSt11__terminatePFvvE",
                "package": "libc++abi.dylib",
                "in_app": False,
            },
        ]
    )

    _run_report_test_with_event(event, should_be_reported)


@pytest.mark.parametrize(
    "frames,should_be_reported",
    [
        ([], False),
        ([{"empty": "frame"}], False),
        ([get_sentry_frame("-[Sentry]")], True),
        ([get_sentry_frame("-[Sentry]", in_app=True)], True),
        (
            [
                {
                    "function": "__handleUncaughtException",
                    "symbol": "__handleUncaughtException",
                    "package": "CoreFoundation",
                    "in_app": False,
                },
                {
                    "function": "_objc_terminate",
                    "symbol": "_ZL15_objc_terminatev",
                    "package": "libobjc.A.dylib",
                    "in_app": False,
                },
                get_sentry_frame("sentrycrashdl_getBinaryImage"),
                {
                    "function": "std::__terminate",
                    "symbol": "_ZSt11__terminatePFvvE",
                    "package": "libc++abi.dylib",
                    "in_app": False,
                },
            ],
            True,
        ),
        (
            [
                IN_APP_FRAME,
                {
                    "function": "__handleUncaughtException",
                    "symbol": "__handleUncaughtException",
                    "package": "CoreFoundation",
                    "in_app": False,
                },
                {
                    "function": "_objc_terminate",
                    "symbol": "_ZL15_objc_terminatev",
                    "package": "libobjc.A.dylib",
                    "in_app": False,
                },
                get_sentry_frame("sentrycrashdl_getBinaryImage"),
                {
                    "function": "std::__terminate",
                    "symbol": "_ZSt11__terminatePFvvE",
                    "package": "libc++abi.dylib",
                    "in_app": False,
                },
            ],
            False,
        ),
    ],
    ids=[
        "no_frames_not_detected",
        "empty_frame_not_detected",
        "single_frame_is_detected",
        "single_in_app_frame_is_detected",
        "only_non_inapp_after_sentry_frame_is_detected",
        "only_inapp_after_sentry_frame_not_detected",
    ],
)
def test_report_cocoa_sdk_crash_frames(self, frames, should_be_reported):
    event = get_crash_event_with_frames(frames)

    _run_report_test_with_event(event, should_be_reported)


def test_sdk_crash_detected_event_is_not_reported(self):
    event = get_crash_event()
    event["contexts"]["sdk_crash_detection"] = {"detected": True}

    _run_report_test_with_event(event, should_be_reported=False)


def test_cocoa_sdk_crash_detection_without_context(self):
    event = get_crash_event(function="-[SentryHub getScope]")
    event["contexts"] = {}

    _run_report_test_with_event(event, True)


def given_crash_detector() -> Tuple[SDKCrashDetection, SDKCrashReporter]:
    crash_reporter = Mock(spec=SDKCrashReporter)
    cocoa_sdk_crash_detector = CocoaSDKCrashDetector()

    event_stripper = Mock()
    event_stripper.strip_event_data = MagicMock(side_effect=lambda x: x)

    crash_detection = SDKCrashDetection(crash_reporter, cocoa_sdk_crash_detector, event_stripper)

    return crash_detection, crash_reporter


def _run_report_test_with_event(event, should_be_reported):
    crash_detector, crash_reporter = given_crash_detector()

    crash_detector.detect_sdk_crash(event)

    if should_be_reported:
        assert_sdk_crash_reported(crash_reporter, event)
    else:
        assert_no_sdk_crash_reported(crash_reporter)


def assert_sdk_crash_reported(
    crash_reporter: SDKCrashReporter, expected_event: Sequence[Mapping[str, Any]]
):
    crash_reporter.report.assert_called_once_with(expected_event)

    reported_event = crash_reporter.report.call_args.args[0]
    assert reported_event["contexts"]["sdk_crash_detection"]["detected"] is True


def assert_no_sdk_crash_reported(self, crash_reporter: SDKCrashReporter):
    crash_reporter.report.assert_not_called()
