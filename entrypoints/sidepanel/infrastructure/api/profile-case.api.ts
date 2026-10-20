import { http } from "../../helpers/helpers-http";
import { GetProfileCasesResponse, ProfileCase } from "../../types/types";
import { dataUrlToBlob } from "../../helpers/helpers";

export const getProfileCases = async (filter?: any) => {
    const response = await http.get('/profile-cases', {
        params: {
            ...(filter && { filter: JSON.stringify(filter) }),
        },
    });
    return response.data as GetProfileCasesResponse;
}

export const createProfileCase = async (
    profileCase: ProfileCase,
    dataUrls: string[],
    metadata: { name: string; description: string; capture_time: number }[],
) => {
    const form = new FormData();

    form.append("profileCase", JSON.stringify({
        name: profileCase.name,
        platform: profileCase.platform,
        profile_url: profileCase.profile_url,
        origin_url: profileCase.origin_url,
        description: profileCase.description
    }));
    form.append("evidens", JSON.stringify(metadata));

    dataUrls.forEach((dataUrl, i) => {
        const blob = dataUrlToBlob(dataUrl);
        form.append("files", blob, `screenshot-${Date.now()}-${i}.png`);
    });

    const response = await http.post('/profile-cases', form)
    return response.data as ProfileCase
}

export const patchCaseInfo = async (
    profileCaseId: string,
    info: { name?: string; platform?: string; profile_url?: string; origin_url?: string; description?: string; },
    updateImages: { id: string; name: string; description: string }[],
    deleteIds: string[]
) => {
    const response = await http.patch(`/profile-cases/${profileCaseId}`, {
        ...info,
        update_images: updateImages,
        delete_ids: deleteIds
    })
    return response.data as ProfileCase
}

export const postCaseImages = async (
    profileCaseId: string,
    dataUrls: string[],
    metadata: { name: string; description: string; capture_time: number }[]
) => {
    const form = new FormData();
    form.append("evidens", JSON.stringify(metadata));
    await Promise.all(
        dataUrls.map(async (dataUrl, i) => {
            const blob = dataUrlToBlob(dataUrl);
            form.append("files", blob, `screenshot-${Date.now()}-${i}.png`);
        })
    );

    await http.post(`/profile-cases/${profileCaseId}/images`, form)
}