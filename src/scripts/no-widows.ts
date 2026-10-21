// Keeps the last two words of each paragraph in rendered HTML together, so no
// paragraph ends on a word alone. text-wrap: pretty only does this some of the
// time, and not in every browser. A span is used rather than &nbsp;, which
// the display font draws with no width. A paragraph that ends in markup (a
// link or badge) is left alone.
export default function noWidows(html: string) {
  return html.replace(
    /(\s)([^\s<>]+) ([^\s<>]+)(\s*<\/(?:p|figcaption)>)/g,
    '$1<span class="whitespace-nowrap">$2 $3</span>$4',
  );
}
