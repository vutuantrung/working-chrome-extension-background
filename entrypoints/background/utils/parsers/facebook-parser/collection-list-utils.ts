export type FacebookCollectionListKind = "following" | "followers" | "friends";

export function readString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

export function detectCollectionListKind(meta: {
  name?: string;
  url?: string;
  tabKey?: string;
  edges?: unknown[];
}): FacebookCollectionListKind | null {
  const tabKey = readString(meta.tabKey).toLowerCase();
  if (tabKey === "friends_all") return "friends";
  if (tabKey === "followers") return "followers";
  if (tabKey === "following") return "following";

  const name = readString(meta.name).toLowerCase();
  const url = readString(meta.url).toLowerCase();

  if (
    name.includes("đang theo dõi") ||
    name.includes("dang theo doi") ||
    url.includes("/following")
  ) {
    return "following";
  }
  if (
    name.includes("người theo dõi") ||
    name.includes("nguoi theo doi") ||
    url.includes("/followers")
  ) {
    return "followers";
  }
  if (
    name.includes("bạn bè") ||
    name.includes("ban be") ||
    url.includes("/friends")
  ) {
    return "friends";
  }

  if (Array.isArray(meta.edges) && meta.edges.length > 0) {
    for (const edge of meta.edges) {
      const node = (edge as any)?.node;
      if (!node) continue;

      const actionsRendererType = readString(node.actions_renderer?.__typename);

      if (actionsRendererType.includes("FriendsList")) {
        return "friends";
      }
    }
  }

  return null;
}

export type ProfileTabCollectionRef = {
  tabKey: string;
  collectionId: string;
  kind: FacebookCollectionListKind;
};

/** Read followers / following / friends_all collection ids from profile header tabs. */
export function extractProfileTabCollections(
  payload: unknown,
): ProfileTabCollectionRef[] {
  const root = payload as {
    data?: {
      user?: {
        profile_header_renderer?: {
          profile_tabs?: {
            profile_user?: {
              timeline_nav_app_sections?: { edges?: unknown[] };
            };
          };
          user?: {
            profile_tabs?: {
              profile_user?: {
                timeline_nav_app_sections?: { edges?: unknown[] };
              };
            };
          };
        };
      };
    };
  };

  const header = root?.data?.user?.profile_header_renderer;
  const profileTabs = header?.profile_tabs || header?.user?.profile_tabs;
  const edges = profileTabs?.profile_user?.timeline_nav_app_sections?.edges;
  if (!Array.isArray(edges)) return [];

  const out: ProfileTabCollectionRef[] = [];
  for (const edge of edges) {
    const section = (edge as { node?: Record<string, unknown> })?.node;
    if (!section || typeof section !== "object") continue;

    const collections = Array.isArray(
      (section as { all_collections?: { nodes?: unknown[] } }).all_collections
        ?.nodes,
    )
      ? (section as { all_collections: { nodes: unknown[] } }).all_collections
          .nodes
      : [];

    for (const c of collections) {
      const node = c as {
        tab_key?: string;
        id?: string;
        name?: string;
        url?: string;
      };
      const tabKey = readString(node?.tab_key);
      const collectionId = readString(node?.id);
      if (!tabKey || !collectionId) continue;

      const kind = detectCollectionListKind({
        tabKey,
        name: readString(node?.name),
        url: readString(node?.url),
      });
      if (!kind) continue;

      out.push({ tabKey, collectionId, kind });
    }
  }

  return out;
}

export type ResolvedCollectionPage = {
  collectionId: string;
  edges: unknown[];
  kind: FacebookCollectionListKind;
};

export function resolveCollectionPageFromPayload(payload: {
  data?: { node?: Record<string, unknown>; user?: { id?: string } };
}): ResolvedCollectionPage | null {
  const node = payload?.data?.node;
  if (!node || typeof node !== "object") return null;

  if (node.__typename === "TimelineAppCollection") {
    const collectionId = readString(node.id);
    const edges = Array.isArray(
      (node.pageItems as { edges?: unknown[] } | undefined)?.edges,
    )
      ? (node.pageItems as { edges: unknown[] }).edges
      : [];
    if (!collectionId || !edges.length) return null;

    const name = readString(node.name);
    const url = readString(node.url);
    const kind =
      detectCollectionListKind({ name, url, edges }) ||
      ("following" as FacebookCollectionListKind);

    return { collectionId, edges, kind };
  }

  if (node.__typename !== "TimelineAppSection") return null;

  const navNodes = Array.isArray(
    (node.nav_collections as { nodes?: unknown[] } | undefined)?.nodes,
  )
    ? (node.nav_collections as { nodes: unknown[] }).nodes
    : [];

  const navKindById = new Map<string, FacebookCollectionListKind>();
  for (const nav of navNodes) {
    const n = nav as { id?: string; name?: string; url?: string };
    const id = readString(n?.id);
    const kind = detectCollectionListKind({
      name: readString(n?.name),
      url: readString(n?.url),
    });
    if (id && kind) navKindById.set(id, kind);
  }

  const collections = Array.isArray(
    (node.all_collections as { nodes?: unknown[] } | undefined)?.nodes,
  )
    ? (node.all_collections as { nodes: unknown[] }).nodes
    : [];

  for (const c of collections) {
    const wrapper = c as {
      id?: string;
      tab_key?: string;
      style_renderer?: {
        collection?: {
          id?: string;
          name?: string;
          url?: string;
          pageItems?: { edges?: unknown[] };
        };
      };
    };
    const inner = wrapper?.style_renderer?.collection;
    const edges = Array.isArray(inner?.pageItems?.edges)
      ? inner.pageItems.edges
      : [];
    if (!edges.length) continue;

    const collectionId = readString(inner?.id) || readString(wrapper?.id);
    if (!collectionId) continue;

    const kind =
      navKindById.get(collectionId) ||
      navKindById.get(readString(wrapper?.id)) ||
      detectCollectionListKind({
        tabKey: readString(wrapper?.tab_key),
        name: readString(inner?.name),
        url: readString(inner?.url),
        edges,
      });

    if (!kind) continue;

    return { collectionId, edges, kind };
  }

  return null;
}

export function extractListPersonFromEdge(edge: unknown): {
  id: string;
  name: string;
  url: string;
  avatar: string;
} | null {
  const node = (edge as { node?: Record<string, unknown> })?.node;
  if (!node) return null;

  const id =
    readString((node.node as { id?: string } | undefined)?.id) ||
    readString(
      (
        node.actions_renderer as {
          profile_actions?: { profile_owner?: { id?: string } }[];
        }
      )?.profile_actions?.[0]?.profile_owner?.id,
    );
  if (!id) return null;

  const nameRaw =
    readString((node.title as { text?: string } | undefined)?.text) ||
    readString(
      (
        node.actions_renderer as {
          profile_actions?: { profile_owner?: { name?: string } }[];
        }
      )?.profile_actions?.[0]?.profile_owner?.name,
    );

  return {
    id,
    name: nameRaw,
    url: readString(node.url) || readString((node.node as { url?: string })?.url),
    avatar: readString((node.image_v2 as { uri?: string } | undefined)?.uri),
  };
}
