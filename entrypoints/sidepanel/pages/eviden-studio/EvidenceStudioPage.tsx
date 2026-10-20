import WorkspacePageHeader from "../../components/WorkspacePageHeader";
import "../../assets/css/features/eviden-studio.css";
import { DEFAULT_CASE_ID, DEFAULT_PAGE_SIZE } from "../../helpers/constants";
import { useState, useEffect } from "react";
import {
  browserTabs,
  extensionStorage as storageService,
} from "../../../sidepanel/application/services/SidepanelServices";
import { CaseFilter, ProfileCase, GetProfileCasesResponse, PlatformId } from "../../types/types";
import CaseSidebar from "../../components/EvidenStudio/CaseSidebar";
import CaseDetail from "../../components/EvidenStudio/CaseDetail";
import { useTranslation } from "../../helpers/i18n";
import api from "../../infrastructure/api";

interface EvidenStudioProps {
  platform: PlatformId
}

function EvidenStudio({ platform }: EvidenStudioProps) {
  const { t } = useTranslation();
  const DEFAULT_CASE = {
    id: DEFAULT_CASE_ID,
    name: "- not set -",
    platform,
    profile_url: "",
    origin_url: "",
    description: "",
    profile_id: "",
    created_time: 0,
    updated_time: 0,
  }

  const [isOpenSidebar, setIsOpenSidebar] = useState(true)
  const [defaultCase, setDefaultCase] = useState<ProfileCase>(DEFAULT_CASE)
  const [profileCases, setProfileCases] = useState<GetProfileCasesResponse>()
  const [filter, setFilter] = useState<CaseFilter>({
    search: '',
    offset: 0,
    limit: DEFAULT_PAGE_SIZE
  })
  const [refresh, setRefresh] = useState(true)
  const [currentUrl, setCurrentUrl] = useState<string>()

  useEffect(() => {
    const fetchCases = async () => {
      const { search, limit, offset } = filter;
      const data = await api.profileCase.getProfileCases({
        ...(search ? {
          where: { name: { like: `%${search}%` } }
        } : {}),
        include: [{ relation: 'profileCaseEvidens' }],
        limit,
        offset,
        order: ['created_time DESC'],
      });
      setProfileCases(data)
    }
    fetchCases()
  }, [refresh, filter])

  const [selectedCase, setSelectedCase] = useState(defaultCase)

  useEffect(() => {
    if (!profileCases?.data.length) return;

    storageService.get(["lastUnsavedProfileCase"]).then((result) => {
      const lastUnsavedProfileCase = result.lastUnsavedProfileCase as { id: string; timestamp: number }
      const findProfileCase = profileCases.data.find(c => c.id === lastUnsavedProfileCase?.id);
      if (findProfileCase) setSelectedCase(findProfileCase)
    });

  }, [profileCases])

  useEffect(() => {
    const detectCurrentPlatform = async () => {
      const tab = await browserTabs.getActiveTab();
      setCurrentUrl(tab?.url || tab?.pendingUrl)

      const { newProfileCaseCache } = await storageService.get(["newProfileCaseCache"]);

      const newDefaultCase = {
        ...defaultCase,
        name: newProfileCaseCache?.name ?? defaultCase.name,
        description: newProfileCaseCache?.description ?? defaultCase.description,
        profile_url: newProfileCaseCache?.profile_url ?? defaultCase.profile_url,
        origin_url: newProfileCaseCache?.origin_url || tab?.url || tab?.pendingUrl || ""
      }

      setDefaultCase(newDefaultCase)
      if (selectedCase.id === defaultCase.id) {
        setSelectedCase(newDefaultCase)
      }
    };
    detectCurrentPlatform();
  }, []);

  const handleSave = (newCase: ProfileCase, currentCase: ProfileCase) => {
    setRefresh(!refresh)
    storageService.set({
      lastUnsavedProfileCase: {
        id: newCase.id,
        timestamp: Date.now()
      }
    });

    if (currentCase.id === DEFAULT_CASE_ID) {
      setDefaultCase({ ...DEFAULT_CASE, origin_url: currentUrl ?? "" })
    }
  }

  return (
    <div className="eviden-studio-page">

      <WorkspacePageHeader
        eyebrow={t("evidenceEyebrow")}
        title={t("evidenceTitle")}
        description={t("evidenceDescription")}
      />

      <div className="eviden-studio">
        <CaseSidebar
          profileCases={profileCases}
          defaultCase={defaultCase}
          isOpen={isOpenSidebar}
          onToggle={() => setIsOpenSidebar(!isOpenSidebar)}
          selectedCase={selectedCase}
          onSelect={(newCase) => setSelectedCase(newCase)}
          setFilter={(filter) => setFilter(filter)}
        />
        <CaseDetail
          setDefaultCase={setDefaultCase}
          selectedCase={selectedCase}
          sidebarOpen={isOpenSidebar}
          onOpenSidebar={() => setIsOpenSidebar(true)}
          onSaved={handleSave}
        />
      </div>
    </div>
  )
}

export default EvidenStudio;