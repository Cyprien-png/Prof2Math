/**
 * Get the x,y coordinates of the caret in a textarea
 */
export function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
    const div = document.createElement('div');
    document.body.appendChild(div);

    const style = div.style;
    const computed = window.getComputedStyle(element);

    style.whiteSpace = 'pre-wrap';
    style.wordWrap = 'break-word';
    style.position = 'absolute';
    style.visibility = 'hidden';

    // Copy essential properties
    const properties = [
        'direction',
        'boxSizing',
        'width',
        'height',
        'overflowX',
        'overflowY',
        'borderTopWidth',
        'borderRightWidth',
        'borderBottomWidth',
        'borderLeftWidth',
        'borderStyle',
        'paddingTop',
        'paddingRight',
        'paddingBottom',
        'paddingLeft',
        'fontStyle',
        'fontVariant',
        'fontWeight',
        'fontStretch',
        'fontSize',
        'fontSizeAdjust',
        'lineHeight',
        'fontFamily',
        'textAlign',
        'textTransform',
        'textIndent',
        'textDecoration',
        'letterSpacing',
        'wordSpacing',
        'tabSize',
        'MozTabSize'
    ];

    properties.forEach(prop => {
        // @ts-ignore
        style[prop] = computed[prop];
    });

    if (navigator.userAgent.toLowerCase().indexOf('firefox') > -1) {
        style.overflow = 'hidden';
    } else {
        style.overflow = 'hidden';
    }

    div.textContent = element.value.substring(0, position);

    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.';
    div.appendChild(span);

    const coordinates = {
        top: span.offsetTop + parseInt(computed['borderTopWidth']),
        left: span.offsetLeft + parseInt(computed['borderLeftWidth']),
        height: parseInt(computed['lineHeight'])
    };

    document.body.removeChild(div);

    return coordinates;
}
