export const successIcon = `
    <svg viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#45d100" stroke-width="3"/>
        <path d="M14 24l7 7 14-15" fill="none" stroke="#45d100" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

export const warningIcon = `
    <svg viewBox="0 0 48 48">
        <path d="M24 6L44 41H4L24 6Z" fill="none" stroke="#ff9f1a" stroke-width="3"/>
        <path d="M24 17v12" stroke="#ff9f1a" stroke-width="3" stroke-linecap="round"/>
        <circle cx="24" cy="35" r="2" fill="#ff9f1a"/>
    </svg>`;

export const waitingIcon = `
    <svg viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#222" stroke-width="3"/>
        <path d="M24 12v13l9 5" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/>
    </svg>`;

export function xpathStringLiteral(value: string): string {
    if (!value.includes("'")) {
        return `'${value}'`;
    }
    if (!value.includes('"')) {
        return `"${value}"`;
    }
    return "concat('" + value.replace(/'/g, "',\"'\",'") + "')";
}

export const FB_PROFILE_STATUS_MAP = {
    "NOT_EXIST_NO_UPDATE": {
        code: "NOT_EXIST_NO_UPDATE",
        icon: "❗",
        backgroundColor: "#a0b107",
        color: "#fff",
        text: "CHƯA RÀ SOÁT",
        dropdown: ["+ BỔ SUNG"]
    },
    "NOT_EXIST": {
        code: "NOT_EXIST",
        icon: "❗",
        backgroundColor: "#b93b13",
        color: "#fff",
        text: "CHƯA RÀ SOÁT",
        dropdown: ["+ BỔ SUNG"]
    },
    "ASSIGNED": {
        code: "ASSIGNED",
        icon: "✓",
        backgroundColor: "#4b7f1f",
        color: "#fff",
        text: "ĐÃ PHÂN CÔNG",
        dropdown: []
    },
    "UNASSIGNED": {
        code: "UNASSIGNED",
        icon: "ℹ",
        backgroundColor: "#6554c0",
        color: "#fff",
        text: "ĐÃ RÀ SOÁT",
        dropdown: []
    }
};

export function addPopupStyles() {
    if (document.getElementById("popup-style")) return;

    const style = document.createElement("style");
    style.id = "popup-style";
    style.textContent = `
        body {
            margin: 0;
            min-height: 100vh;
            background: #d9d9df;
            font-family: Arial, sans-serif;
        }

        .popup-wrap {
            position: fixed;
            top: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 14px;
            z-index: 9999;
        }

        .popup-card {
            width: 335px;
            min-height: 72px;
            display: flex;
            overflow: hidden;
            background: #fff;
            border-radius: 14px;
            box-shadow: 0 12px 28px rgba(0, 0, 0, 0.16);
            animation: popupIn 0.25s ease;
        }

        .popup-content {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 18px;
        }

        .popup-icon {
            width: 38px;
            height: 38px;
            flex-shrink: 0;
        }

        .popup-title {
            margin: 0;
            color: #333;
            font-size: 15px;
            font-weight: 700;
        }

        .popup-message {
            margin: 3px 0 0;
            color: #888;
            font-size: 12px;
            line-height: 1.25;
        }

        .popup-actions {
            width: 72px;
            display: flex;
            flex-direction: column;
            border-left: 1px solid #e5e5e5;
        }

        .popup-action {
            flex: 1;
            border: 0;
            background: #fff;
            color: #555;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
        }

        .popup-action + .popup-action {
            border-top: 1px solid #e5e5e5;
        }

        .popup-action:hover {
            background: #f6f6f6;
        }

        @keyframes popupIn {
            from {
            opacity: 0;
            transform: translateY(-10px) scale(0.98);
            }
            to {
            opacity: 1;
            transform: translateY(0) scale(1);
            }
        }`;

    document.head.appendChild(style);
}