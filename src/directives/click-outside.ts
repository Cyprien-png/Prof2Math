import type { DirectiveBinding } from 'vue';

const clickOutside = {
    beforeMount(el: HTMLElement, binding: DirectiveBinding) {
        // @ts-ignore
        el.clickOutsideEvent = function (event: Event) {
            // Check if click was outside the element and its children
            if (!(el === event.target || el.contains(event.target as Node))) {
                // Parse optional arguments (function)
                if (typeof binding.value === 'function') {
                    binding.value(event);
                }
            }
        };
        // @ts-ignore
        document.body.addEventListener('click', el.clickOutsideEvent);
        // @ts-ignore
        document.body.addEventListener('contextmenu', el.clickOutsideEvent);
    },
    unmounted(el: HTMLElement) {
        // @ts-ignore
        document.body.removeEventListener('click', el.clickOutsideEvent);
        // @ts-ignore
        document.body.removeEventListener('contextmenu', el.clickOutsideEvent);
    },
};

export default clickOutside;
