import { ApplicationServices } from "../../application-services";
import { Message } from "../../types/types";
import apiCall from "../../infrastructure/api";

export async function handleExternalApiCall(
    applicationServices: ApplicationServices,
    message: Message,
    sendResponse: (resp: any) => void
) {
    const { serviceName, body } = message.inputs;
    switch (serviceName) {
        // extension user
        case "login": {
            const { username, password, extensionId } = body;
            apiCall.extensionUser
                .login(applicationServices.http?.getHttpInstance(), username, password, extensionId)
                .then(response => sendResponse(response));
            break;
        }
        case "loginByApiKey": {
            const { apiKey, extensionId } = body;
            apiCall.extensionUser
                .loginByApikey(applicationServices.http?.getHttpInstance(), apiKey, extensionId)
                .then(response => sendResponse(response));
            break;
        }
        case "logout": {
            const { extensionId } = body;
            apiCall.extensionUser
                .logout(applicationServices.http?.getHttpInstance(), extensionId)
                .then(response => sendResponse(response));
            break;
        }
        case "updateExtensionSession": {
            const { extensionId, payload } = body;
            apiCall.extensionUser
                .updateExtensionSession(applicationServices.http?.getHttpInstance(), extensionId, payload)
                .then(response => sendResponse(response));
            break;
        }
        case "getExtensionConfigInfo": {
            const { extensionConfigId, filter } = body;
            apiCall.extensionUser
                .getExtensionConfigInfo(applicationServices.http?.getHttpInstance(), extensionConfigId, filter)
                .then(response => sendResponse(response));
            break;
        }
        case "deactivatePersona": {
            const { personaId } = body;
            apiCall.extensionUser
                .deactivatePersona(applicationServices.http?.getHttpInstance(), personaId)
                .then(response => sendResponse(response));
            break;
        }
        case "activatePersonaSession": {
            const { personaId } = body;
            apiCall.extensionUser
                .activatePersonaSession(applicationServices.http?.getHttpInstance(), personaId)
                .then(response => sendResponse(response));
            break;
        }

        // persona
        case "getPersonas": {
            const { userId, filter } = body;
            apiCall.persona
                .getPersonas(applicationServices.http?.getHttpInstance(), userId, filter)
                .then(response => sendResponse(response));
            break;
        }
        case "createPersona": {
            apiCall.persona
                .createPersona(applicationServices.http?.getHttpInstance())
                .then(response => sendResponse(response));
            break;
        }
        case "getPersonaById": {
            const { persona_id } = body;
            apiCall.persona
                .getPersonaById(applicationServices.http?.getHttpInstance(), persona_id)
                .then(response => sendResponse(response));
            break;
        }
        case "getProxiesByPersona": {
            const { personaId, filter } = body;
            apiCall.proxy
                .getProxiesByPersona(applicationServices.http?.getHttpInstance(), personaId, filter)
                .then(response => sendResponse(response));
            break;
        }
        case "getProxyInfo": {
            const { proxy_id } = body;
            apiCall.proxy
                .getProxyInfo(applicationServices.http?.getHttpInstance(), proxy_id)
                .then(response => sendResponse(response));
            break;
        }
        case "getSocialAccountProxy": {
            const { id } = body;
            apiCall.socialAccount
                .getSocialAccountProxy(applicationServices.http?.getHttpInstance(), id)
                .then(response => sendResponse(response));
            break;
        }
        case "getSocialAccountGroups": {
            const { id, offset, limit } = body;
            apiCall.socialAccount
                .getSocialAccountGroups(applicationServices.http?.getHttpInstance(), id, offset, limit)
                .then(response => sendResponse(response));
            break;
        }
        case "getSocialAccountsByPersona": {
            const { personaId, filter } = body;
            apiCall.socialAccount
                .getSocialAccountsByPersona(applicationServices.http?.getHttpInstance(), personaId, filter)
                .then(response => sendResponse(response));
            break;
        }

        // profile
        case "getProfileCases": {
            const { filter } = body;
            apiCall.profileCase
                .getProfileCases(applicationServices.http?.getHttpInstance(), filter)
                .then(response => sendResponse(response));
            break;
        }
        case "createProfileCase": {
            const { profileCase, dataUrls, metadata } = body;
            apiCall.profileCase
                .createProfileCase(applicationServices.http?.getHttpInstance(), profileCase, dataUrls, metadata)
                .then(response => sendResponse(response));
            break;
        }
        case "patchCaseInfo": {
            const { profileCaseId, info, updateImages, deleteIds } = body;
            apiCall.profileCase
                .patchCaseInfo(applicationServices.http?.getHttpInstance(), profileCaseId, info, updateImages, deleteIds)
                .then(response => sendResponse(response));
            break;
        }
        case "postCaseImages": {
            const { profileCaseId, dataUrls, metadata } = body;
            apiCall.profileCase
                .postCaseImages(applicationServices.http?.getHttpInstance(), profileCaseId, dataUrls, metadata)
                .then(response => sendResponse(response));
            break;
        }

        case "getMemberSourcesGroup": {
            const { accountId, status, search, offset, limit, platform, type } = body;
            apiCall.sourceMember
                .getMemberSourcesGroup(applicationServices.http?.getHttpInstance(), accountId, status, search, offset, limit, platform, type)
                .then(response => sendResponse(response));
            break;
        }
        case "getMemberSourcesApi": {
            const { data, status, search, offset, limit, platform, type, assigneeId } = body;
            apiCall.sourceMember
                .getMemberSourcesApi(applicationServices.http?.getHttpInstance(), data, status, search, offset, limit, platform, type, assigneeId)
                .then(response => sendResponse(response));
            break;
        }
        default: sendResponse(null);
    }
}