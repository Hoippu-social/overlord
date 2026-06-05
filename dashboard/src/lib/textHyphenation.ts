const CYRILLIC_WORD_RE = /[\u0400-\u04FF]+/g;
const CYRILLIC_LETTER_RE = /[\u0400-\u04FF]/;
const LATIN_WORD_RE = /[A-Za-z]+/g;
const LATIN_LETTER_RE = /[A-Za-z]/;
const SOFT_HYPHEN = '\u00AD';
const CYRILLIC_VOWELS = new Set(Array.from('\u0430\u0435\u0451\u0438\u043e\u0443\u044b\u044d\u044e\u044f\u0410\u0415\u0401\u0418\u041e\u0423\u042b\u042d\u042e\u042F'));
const LATIN_VOWELS = new Set(Array.from('aeiouyAEIOUY'));

function hyphenateWord(word: string, vowels: Set<string>, letterRe: RegExp) {
    const chars = Array.from(word);

    if (chars.length < 7 || !chars.some((char) => vowels.has(char))) {
        return word;
    }

    const vowelIndexes = chars
        .map((char, index) => vowels.has(char) ? index : -1)
        .filter((index) => index >= 0);

    if (vowelIndexes.length < 2) {
        return word;
    }

    const breakPoints = new Set<number>();

    for (let i = 0; i < vowelIndexes.length - 1; i += 1) {
        const currentVowel = vowelIndexes[i];
        const nextVowel = vowelIndexes[i + 1];
        const consonantsBetween = chars
            .slice(currentVowel + 1, nextVowel)
            .filter((char) => letterRe.test(char) && !vowels.has(char))
            .length;

        let breakPoint = currentVowel + 1;

        if (consonantsBetween === 1 || consonantsBetween === 2) {
            breakPoint = nextVowel - 1;
        } else if (consonantsBetween > 2) {
            breakPoint = nextVowel - 2;
        }

        if (breakPoint >= 2 && breakPoint <= chars.length - 2) {
            breakPoints.add(breakPoint);
        }
    }

    return chars
        .map((char, index) => breakPoints.has(index) ? `${SOFT_HYPHEN}${char}` : char)
        .join('');
}

export function hyphenateServerName(value?: string | null) {
    if (!value) {
        return '';
    }

    return value
        .replace(CYRILLIC_WORD_RE, (word) => hyphenateWord(word, CYRILLIC_VOWELS, CYRILLIC_LETTER_RE))
        .replace(LATIN_WORD_RE, (word) => hyphenateWord(word, LATIN_VOWELS, LATIN_LETTER_RE));
}
