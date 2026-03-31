export type BilingualText = {
    en: string;
    ru: string;
};

export function localizeDescription<T extends { setDescription: (description: string) => any; setDescriptionLocalizations: (localizations: Record<string, string>) => any }>(
    target: T,
    text: BilingualText
) {
    target.setDescription(text.en);
    target.setDescriptionLocalizations({ ru: text.ru });
    return target;
}
