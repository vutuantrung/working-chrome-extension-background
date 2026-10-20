import { http } from "../../helpers/helpers-http";

export const getSocialAccountProxy = async (id: string) => {
    const response = await http.get(`/social-account/${id}/proxy`);
    return response.data;
};

export const getSocialAccountGroups = async (id: string, offset?: number, limit?: number) => {
    const filterVal: Record<string, any> = {
        limit: limit ?? 10,
        offset: offset ?? 0,
    };

    const response = await http.get(
        `/social-account/${id}/groups`, {
        params: { filter: JSON.stringify(filterVal) },
    });
    return response.data;
};

export const getSocialAccountsByPersona = async (personaId: string, filter?: any) => {
    const response = await http.get(
        "/social-account",
        {
            params: {
                filter: JSON.stringify({
                    offset: 0,
                    limit: 100,
                    where: { persona_id: personaId },
                    ...(filter || {}),
                }),
            },
        });

    return response.data;
};