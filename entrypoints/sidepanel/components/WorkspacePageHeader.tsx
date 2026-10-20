import "../assets/css/components/WorkspacePageHeader.css";

interface WorkspacePageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  badge?: string;
}

/** Shared dashboard-style page heading. */
export default function WorkspacePageHeader({ eyebrow, title, description, badge }: WorkspacePageHeaderProps) {
  return (
    <header className="workspace-page-header">
      <div className="workspace-page-header__copy">
        <div className="workspace-page-header__eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {badge && <span className="workspace-page-header__badge">{badge}</span>}
    </header>
  );
}
