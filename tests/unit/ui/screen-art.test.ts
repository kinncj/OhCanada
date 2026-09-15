import { describe, expect, it } from 'vitest';

import { createArtFrame, createStamp, cssUrl, LANDSCAPE_URL } from '@ui/screen-art';

import { buildPage, FakeEvent, type FakeElement } from './support/fake-dom';

/**
 * ADR-0041: a picture on a DOM screen is decoration beside the words.
 *
 * What would be wrong if this file lied: a picture a screen reader announces
 * (an image with no `alt=""`, a frame not `aria-hidden`), a picture that holds
 * focus, or a picture that fails to load and leaves an empty box behind.
 */

function frameOf(page: ReturnType<typeof buildPage>, testId: string): FakeElement {
  const node = page.doc.byTestId(testId);
  if (node === null) throw new Error(`${testId} is not on the page`);
  return node;
}

describe('an art frame', () => {
  function mount() {
    const page = buildPage();
    const art = createArtFrame(page.document, { className: 'tn-card-art', testId: 'art' });
    page.ui.append(art.element as unknown as FakeElement);
    const frame = frameOf(page, 'art');
    const image = frame.querySelector('img') as FakeElement;
    return { page, art, frame, image };
  }

  it('is hidden from assistive technology, and its image says nothing', () => {
    const { frame, image } = mount();
    expect(frame.getAttribute('aria-hidden')).toBe('true');
    expect(image.getAttribute('alt')).toBe('');
    expect(frame.querySelectorAll('button')).toHaveLength(0);
  });

  it('takes no space until it is given a picture', () => {
    const { art, frame, image } = mount();
    expect(frame.hidden).toBe(true);
    expect(art.state).toBe('empty');
    expect(image.getAttribute('src')).toBeNull();
  });

  it('shows the picture it is given, and says when it has arrived', () => {
    const { art, frame, image } = mount();
    art.show('/img/halifax-landmark-town-clock@1x.030021fe.webp');

    expect(frame.hidden).toBe(false);
    expect(frame.getAttribute('data-state')).toBe('loading');
    expect(image.getAttribute('src')).toBe('/img/halifax-landmark-town-clock@1x.030021fe.webp');

    image.dispatchEvent(new FakeEvent('load'));
    expect(art.state).toBe('ready');
    expect(frame.getAttribute('data-state')).toBe('ready');
    expect(frame.hidden).toBe(false);
  });

  it('is gone, not an empty box, when the picture cannot load', () => {
    const { art, frame, image } = mount();
    art.show('/img/missing.webp');
    image.dispatchEvent(new FakeEvent('error'));

    expect(art.state).toBe('failed');
    expect(frame.getAttribute('data-state')).toBe('failed');
    expect(frame.hidden).toBe(true);
  });

  it('draws nothing again for no picture, and lets go of the one it had', () => {
    const { art, frame, image } = mount();
    art.show('/img/a.webp');
    image.dispatchEvent(new FakeEvent('load'));

    art.show(undefined);
    expect(frame.hidden).toBe(true);
    expect(art.state).toBe('empty');
    expect(image.getAttribute('src')).toBeNull();
    expect(frame.getAttribute('data-src')).toBeNull();
  });

  it('does not reload a picture it is already showing', () => {
    const { art, image } = mount();
    art.show('/img/a.webp');
    image.dispatchEvent(new FakeEvent('load'));
    art.show('/img/a.webp');
    expect(art.state).toBe('ready');
  });

  it('tries a picture again after it failed', () => {
    const { art, frame, image } = mount();
    art.show('/img/a.webp');
    image.dispatchEvent(new FakeEvent('error'));
    art.show('/img/a.webp');
    expect(frame.getAttribute('data-state')).toBe('loading');
    expect(frame.hidden).toBe(false);
  });

  it('ignores a late event once it has been told to show nothing', () => {
    const { art, frame, image } = mount();
    art.show('/img/a.webp');
    art.show(null);
    image.dispatchEvent(new FakeEvent('load'));
    expect(art.state).toBe('empty');
    expect(frame.hidden).toBe(true);
  });

  it('is removed by destroy, image and all', () => {
    const { art, page, image } = mount();
    art.show('/img/a.webp');
    art.destroy();
    expect(page.doc.byTestId('art')).toBeNull();
    expect(image.getAttribute('src')).toBeNull();
  });
});

describe('a stamp', () => {
  function mount() {
    const page = buildPage();
    const stamp = createStamp(page.document, { testId: 'stamp' });
    page.ui.append(stamp.element as unknown as FakeElement);
    const root = frameOf(page, 'stamp');
    const probe = root.querySelector('img') as FakeElement;
    const mark = root.querySelector('.tn-stamp__mark') as FakeElement;
    return { page, stamp, root, probe, mark };
  }

  it('is decoration: hidden from assistive technology, and its probe says nothing', () => {
    const { root, probe } = mount();
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(probe.getAttribute('alt')).toBe('');
    expect(probe.hidden).toBe(true);
    expect(root.hidden).toBe(true);
  });

  it('is pressed in the shape of the landmark once the picture has loaded', () => {
    const { stamp, root, probe, mark } = mount();
    stamp.show('/img/peggys-cove-landmark-lighthouse@1x.2427cbc2.webp', true);

    expect(root.hidden).toBe(false);
    expect(root.getAttribute('data-inked')).toBe('true');
    expect(root.getAttribute('data-state')).toBe('loading');
    expect(mark.style.getPropertyValue('mask-image')).toBe('none');

    probe.dispatchEvent(new FakeEvent('load'));
    expect(stamp.state).toBe('ready');
    expect(mark.style.getPropertyValue('mask-image')).toBe(
      'url("/img/peggys-cove-landmark-lighthouse@1x.2427cbc2.webp")',
    );
    expect(mark.style.getPropertyValue('-webkit-mask-image')).toBe(
      'url("/img/peggys-cove-landmark-lighthouse@1x.2427cbc2.webp")',
    );
  });

  it('is an outline waiting to be pressed when nothing was earned', () => {
    const { stamp, root } = mount();
    stamp.show('/img/a.webp', false);
    expect(root.getAttribute('data-inked')).toBe('false');
    expect(root.hidden).toBe(false);
  });

  it('takes itself away when the picture cannot load', () => {
    const { stamp, root, probe } = mount();
    stamp.show('/img/a.webp', true);
    probe.dispatchEvent(new FakeEvent('error'));
    expect(stamp.state).toBe('failed');
    expect(root.hidden).toBe(true);
  });

  it('draws no stamp for no picture', () => {
    const { stamp, root, probe } = mount();
    stamp.show('/img/a.webp', true);
    stamp.show(undefined, true);
    expect(root.hidden).toBe(true);
    expect(probe.getAttribute('src')).toBeNull();
  });

  it('changes ink without reloading the same picture', () => {
    const { stamp, root, probe } = mount();
    stamp.show('/img/a.webp', false);
    probe.dispatchEvent(new FakeEvent('load'));
    stamp.show('/img/a.webp', true);
    expect(stamp.state).toBe('ready');
    expect(root.getAttribute('data-inked')).toBe('true');
    expect(root.hidden).toBe(false);
  });
});

describe('the pictures a screen may name', () => {
  it('keeps a URL inside url("...") whatever it contains', () => {
    expect(cssUrl('/img/a.webp')).toBe('/img/a.webp');
    expect(cssUrl('/img/"quoted".webp')).toBe('/img/%22quoted%22.webp');
    expect(cssUrl('/img/back\\slash.webp')).toBe('/img/back%5Cslash.webp');
    expect(cssUrl('/img/line\nbreak.webp')).toBe('/img/line%0Abreak.webp');
  });

  it('draws the title and Study landscape from the screen-art home', () => {
    expect(LANDSCAPE_URL).toMatch(/title-landscape.*\.svg/);
  });
});
