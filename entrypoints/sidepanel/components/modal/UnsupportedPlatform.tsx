import { MdErrorOutline } from "../../assets/constants/icons";
import { useTranslation } from "../../helpers/i18n";

function UnsupportedPlatform() {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col flex-1 justify-center items-center">
            <div className="bg-[linear-gradient(135deg,#0ea5e9_0%,#2563eb_100%)] p-5 shadow-[0_4px_12px_rgba(14,165,233,0.2)] rounded-2xl text-2xl text-white">
                <MdErrorOutline className="coming-soon__icon" />
            </div>
            <h2 className="text-base text-gray-800 font-semibold mt-1">{t("unsupportedPlatform")}</h2>
        </div>
    )
}

export default UnsupportedPlatform;