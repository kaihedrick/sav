import cormorantLatin300 from "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-300-normal.woff2?url";

if (!document.querySelector(`link[href="${CSS.escape(cormorantLatin300)}"]`)) {
  const link = document.createElement("link");
  link.rel = "preload";
  link.href = cormorantLatin300;
  link.as = "font";
  link.type = "font/woff2";
  link.crossOrigin = "";
  document.head.prepend(link);
}
