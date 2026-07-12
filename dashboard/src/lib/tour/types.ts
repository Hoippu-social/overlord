export type TourPlacement = 'top' | 'bottom' | 'left' | 'right' | 'auto';

export type TourStep = {
    id: string;
    anchor: string;
    title: { ru: string; en: string };
    body: { ru: string; en: string };
    placement?: TourPlacement;
    padding?: number;
};

export type TourContext = {
    path: string;
    searchParams: URLSearchParams;
};

export type TourDefinition = {
    id: string;
    match: (ctx: TourContext) => boolean;
    steps: TourStep[];
};
