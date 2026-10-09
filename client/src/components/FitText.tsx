import {h, type ComponentChildren, type JSX} from 'preact';
import {useLayoutEffect, useRef} from 'preact/hooks';

type Props = JSX.HTMLAttributes<HTMLElement> & {
  as?: 'span' | 'p' | 'strong' | 'h2' | 'h3';
  children: ComponentChildren;
  /** Smallest size, as a fraction of the CSS font size. */
  min?: number;
};

/**
 * Shrinks its own font size until no single word overflows. Words still wrap between each
 * other; they are never broken mid-word (long translations such as "Guerreiro").
 */
export default function FitText({as: Tag = 'span', children, min = 0.6, ...rest}: Props) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    let frame = 0;
    const fit = () => {
      element.style.fontSize = '';
      const base = parseFloat(getComputedStyle(element).fontSize);
      let size = base;
      while (element.scrollWidth > element.clientWidth + 1 && size > base * min) {
        size -= base * 0.04;
        element.style.fontSize = `${size}px`;
      }
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(fit); };
    fit();
    const observer = new ResizeObserver(schedule);
    observer.observe(element.parentElement ?? element);
    void document.fonts?.ready.then(schedule);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [children, min]);
  return h(Tag, {...rest, ref}, children);
}
