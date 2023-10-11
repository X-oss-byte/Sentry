from __future__ import annotations

import logging

from django.http import HttpResponse
from django.views.generic import View
from rest_framework.request import Request

from sentry.models.integrations.integration import Integration
from sentry.models.integrations.organization_integration import OrganizationIntegration
from sentry.utils import json

logger = logging.getLogger("sentry.webhooks")


class GitHubIntegrationsInstallationEndpoint(View):
    def get(self, request: Request, installation_id):
        try:
            integration = Integration.objects.get(external_id=installation_id)
            OrganizationIntegration.objects.get(id=integration.id)
            return HttpResponse(status=404)
        except Integration.DoesNotExist:
            return HttpResponse(status=404)
        except OrganizationIntegration.DoesNotExist:
            pass

        result = {
            "account_login": integration.name,
            "account_type": integration.metadata["account_type"],
            "sender_login": integration.metadata["sender_login"],
        }
        return HttpResponse(json.dumps(result), status=200)
