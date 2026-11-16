import { AxiosInstance } from "axios";

export const getPersonas = async (http: AxiosInstance, userId: string, filter?: any) => {
    const response = await http.get(
        "/personas",
        {
            params: {
                filter: JSON.stringify({
                    offset: 0,
                    limit: 500,
                    where: { user_id: userId },
                    ...(filter || {}),
                }),
            },
        });

    return response.data;
};

export const createPersona = async (http: AxiosInstance) => {
    const body = {
        generate_conditions: {
            country: "VN",
            topic_ids: [],
        },
        account_and_device_resources: [],
        proxy_resources: [],
        email_resources: [],
        platforms: ["facebook"],
    };

    const response = await http.post("/personas/assign-to-user", body);
    return response.data;
};

export const getPersonaById = async (http: AxiosInstance, persona_id: string) => {
    const response = await http.get(`/personas/${persona_id}`);
    return response.data;
};