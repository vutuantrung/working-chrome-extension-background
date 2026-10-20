import "../../assets/css/components/Persona.css";

interface StatusScreenProps {
    icon: string;
    title: string;
    subtitle?: string;
}

const StatusScreen = ({ icon, title, subtitle }: StatusScreenProps) => (
    <div className="persona-status-screen">
        <span className="persona-status-screen__icon">{icon}</span>
        <p className="persona-status-screen__title">{title}</p>
        {subtitle && <p className="persona-status-screen__subtitle">{subtitle}</p>}
    </div>
);

export default StatusScreen;
