import * as extensionUserApi from "./extension-user.api";
import * as personaApi from "./persona.api";
import * as socialAccountApi from "./social-account.api";
import * as proxyApi from "./proxy.api";
import * as profileCaseApi from "./profile-case.api";

export default {
    extensionUser: { ...extensionUserApi },
    persona: { ...personaApi },
    socialAccount: { ...socialAccountApi },
    proxy: { ...proxyApi },
    profileCase: { ...profileCaseApi },
}