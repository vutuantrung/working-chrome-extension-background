import { useTranslation } from "../helpers/i18n";
import { useState, useEffect } from "react";
import "../assets/css/components/JsonEditor.css";

interface JsonEditorProps {
  settings: any;
  onSave: (data: any) => void;
  onClose: () => void;
}

function JsonEditor({
  settings,
  onSave,
  onClose
}: JsonEditorProps) {
  const { t } = useTranslation();
  const [jsonValue, setJsonValue] = useState("");

  useEffect(() => {
    if (settings) setJsonValue(JSON.stringify(settings, null, 2));
  }, [settings]);

  const handleSave = () => {
    try {
      const data = JSON.parse(jsonValue);
      onSave(data);
    } catch (error) {
      console.error("Invalid JSON:", error);
      alert(t("invalidJson"));
    }
  };

  return (
    <div id="json-input">
      <div className="json-editor__textarea-wrap">
        <textarea
          rows={10} cols={47}
          placeholder={t("jsonPlaceholder")}
          className="json-editor__textarea"
          value={jsonValue}
          onChange={(e) => setJsonValue(e.target.value)}
        />
      </div>
      <button className="button" onClick={handleSave}>
        {t("save")}
      </button>
      <div className="edit-data">
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onClose();
          }}
        >
          {t("editText")}
        </a>
      </div>
    </div>
  );
}

export default JsonEditor;