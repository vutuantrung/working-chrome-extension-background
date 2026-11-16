import { ApplicationServices } from "../../application-services";
import { Message } from "../../types/types";
import apiCall from "../../infrastructure/api";

export async function handleExternalApiCall(
    applicationServices: ApplicationServices,
    message: Message,
    sendResponse: (resp: any) => void
) {
    const { serviceName, body } = message.inputs ?? {};
    if (typeof serviceName !== "string" || !body || typeof body !== "object" || Array.isArray(body)) {
        sendResponse({ success: false, error: "Invalid external service request", code: "INVALID_REQUEST" });
        return;
    }
    try {
    switch (serviceName) {
        // extension user
        case "login": {
            const { username, password, extensionId } = body;
            return await apiCall.extensionUser
                .login(applicationServices.http?.getHttpInstance(), username, password, extensionId)
                .then(response => sendResponse(response));
        }
        case "loginByApiKey": {
            const { apiKey, extensionId } = body;
            return await apiCall.extensionUser
                .loginByApikey(applicationServices.http?.getHttpInstance(), apiKey, extensionId)
                .then(response => sendResponse(response));
        }
        case "logout": {
            const { extensionId } = body;
            return await apiCall.extensionUser
                .logout(applicationServices.http?.getHttpInstance(), extensionId)
                .then(response => sendResponse(response));
        }
        case "updateExtensionSession": {
            const { extensionId, payload } = body;
            return await apiCall.extensionUser
                .updateExtensionSession(applicationServices.http?.getHttpInstance(), extensionId, payload)
                .then(response => sendResponse(response));
        }
        case "getExtensionConfigInfo": {
            const { extensionConfigId, filter } = body;
            return await apiCall.extensionUser
                .getExtensionConfigInfo(applicationServices.http?.getHttpInstance(), extensionConfigId, filter)
                .then(response => sendResponse(response));
        }
        case "deactivatePersona": {
            const { personaId } = body;
            return await apiCall.extensionUser
                .deactivatePersona(applicationServices.http?.getHttpInstance(), personaId)
                .then(response => sendResponse(response));
        }
        case "activatePersonaSession": {
            const { personaId } = body;
            return await apiCall.extensionUser
                .activatePersonaSession(applicationServices.http?.getHttpInstance(), personaId)
                .then(response => sendResponse(response));
        }

        // persona
        case "getPersonas": {
            const { userId, filter } = body;
            return await apiCall.persona
                .getPersonas(applicationServices.http?.getHttpInstance(), userId, filter)
                .then(response => sendResponse(response));
        }
        case "createPersona": {
            return await apiCall.persona
                .createPersona(applicationServices.http?.getHttpInstance())
                .then(response => sendResponse(response));
        }
        case "getPersonaById": {
            const { persona_id } = body;
            return await apiCall.persona
                .getPersonaById(applicationServices.http?.getHttpInstance(), persona_id)
                .then(response => sendResponse(response));
        }
        case "getProxiesByPersona": {
            const { personaId, filter } = body;
            return await apiCall.proxy
                .getProxiesByPersona(applicationServices.http?.getHttpInstance(), personaId, filter)
                .then(response => sendResponse(response));
        }
        case "getProxyInfo": {
            const { proxy_id } = body;
            return await apiCall.proxy
                .getProxyInfo(applicationServices.http?.getHttpInstance(), proxy_id)
                .then(response => sendResponse(response));
        }
        case "getSocialAccountProxy": {
            const { id } = body;
            return await apiCall.socialAccount
                .getSocialAccountProxy(applicationServices.http?.getHttpInstance(), id)
                .then(response => sendResponse(response));
        }
        case "getSocialAccountInfo": {
            const { id } = body;
            return await apiCall.socialAccount
                .getSocialAccountInfo(applicationServices.http?.getHttpInstance(), id)
                .then(response => sendResponse(response));
        }
        case "getSocialAccountGroups": {
            const { id, offset, limit } = body;
            return await apiCall.socialAccount
                .getSocialAccountGroups(applicationServices.http?.getHttpInstance(), id, offset, limit)
                .then(response => sendResponse(response));
        }
        case "getSocialAccountsByPersona": {
            const { personaId, filter } = body;
            return await apiCall.socialAccount
                .getSocialAccountsByPersona(applicationServices.http?.getHttpInstance(), personaId, filter)
                .then(response => sendResponse(response));
        }

        // profile
        case "getProfileCases": {
            const { filter } = body;
            return await apiCall.profileCase
                .getProfileCases(applicationServices.http?.getHttpInstance(), filter)
                .then(response => sendResponse(response));
        }
        case "createProfileCase": {
            const { profileCase, dataUrls, metadata } = body;
            return await apiCall.profileCase
                .createProfileCase(applicationServices.http?.getHttpInstance(), profileCase, dataUrls, metadata)
                .then(response => sendResponse(response));
        }
        case "patchCaseInfo": {
            const { profileCaseId, info, updateImages, deleteIds } = body;
            return await apiCall.profileCase
                .patchCaseInfo(applicationServices.http?.getHttpInstance(), profileCaseId, info, updateImages, deleteIds)
                .then(response => sendResponse(response));
        }
        case "postCaseImages": {
            const { profileCaseId, dataUrls, metadata } = body;
            return await apiCall.profileCase
                .postCaseImages(applicationServices.http?.getHttpInstance(), profileCaseId, dataUrls, metadata)
                .then(response => sendResponse(response));
        }

        case "getMemberSourcesGroup": {
            const { accountId, status, search, offset, limit } = body;
            return await apiCall.sourceMember
                .getMemberSourcesGroup(applicationServices.http?.getHttpInstance(), accountId, status, search, offset, limit)
                .then(response => sendResponse(response));
        }
        case "getMemberSourcesApi": {
            const { data, status, search, offset, limit, platform, type, assigneeId } = body;
            return await apiCall.sourceMember
                .getMemberSourcesApi(applicationServices.http?.getHttpInstance(), data, status, search, offset, limit, platform, type, assigneeId)
                .then(response => sendResponse(response));
        }
        default:
            sendResponse({ success: false, error: "Unsupported external service", code: "UNSUPPORTED_SERVICE" });
    }
    } catch {
        // Do not send Axios errors/configuration (credentials, headers) to clients.
        sendResponse({ success: false, error: "External service request failed", code: "EXTERNAL_SERVICE_FAILED" });
    }
}