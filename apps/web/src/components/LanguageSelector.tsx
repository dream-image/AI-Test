import React from 'react';

const LANGUAGES = {
    eng_Latn: "English",
    fra_Latn: "French",
    deu_Latn: "German",
    spa_Latn: "Spanish",
    ita_Latn: "Italian",
    por_Latn: "Portuguese",
    nld_Latn: "Dutch",
    pol_Latn: "Polish",
    rus_Cyrl: "Russian",
    zho_Hans: "Chinese (Simplified)",
    zho_Hant: "Chinese (Traditional)",
    jpn_Jpan: "Japanese",
    kor_Hang: "Korean",
    arb_Arab: "Arabic",
    hin_Deva: "Hindi",
    tur_Latn: "Turkish",
    vie_Latn: "Vietnamese",
    tha_Thai: "Thai",
    ind_Latn: "Indonesian",
    ukr_Cyrl: "Ukrainian",
};

interface LanguageSelectorProps {
    type: string;
    defaultLanguage: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

function LanguageSelector({ type, defaultLanguage, onChange }: LanguageSelectorProps) {
    return (
        <div className="language-selector">
            <label className="language-label">{type} Language</label>
            <select
                defaultValue={defaultLanguage}
                onChange={onChange}
                className="language-select"
            >
                {Object.entries(LANGUAGES).map(([key, value]) => (
                    <option key={key} value={key}>
                        {value}
                    </option>
                ))}
            </select>
        </div>
    );
}

export default LanguageSelector;
