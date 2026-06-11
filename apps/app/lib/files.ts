/** Open the browser's native file picker (camera/gallery on mobile) for images.
 * Web-only: the console runs on react-native-web, so `document` is available at
 * runtime; guarded for SSR/prerender where it is not. */
export function pickImages(): Promise<File[]> {
  return new Promise((resolve) => {
    if (typeof document === "undefined") {
      resolve([]);
      return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => resolve(input.files ? Array.from(input.files) : []);
    input.click();
  });
}
