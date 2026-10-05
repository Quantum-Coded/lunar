/** Third-party software, assets and trademarks acknowledged on the About page. */
export interface Credit {
  name: string;
  what: string;
  licence: string;
  url?: string;
}

export const credits: Credit[] = [
  { name: "Moon rover 3D model", what: "The rover you drive (OBJ model and textures)", licence: "Third-party asset - credit the author and licence in this file before publishing" },
  { name: "Three.js", what: "3D rendering", licence: "MIT", url: "https://threejs.org" },
  { name: "React Three Fiber", what: "React renderer for Three.js", licence: "MIT", url: "https://r3f.docs.pmnd.rs" },
  { name: "Next.js and React", what: "Web framework", licence: "MIT", url: "https://nextjs.org" },
  { name: "Zustand", what: "State management", licence: "MIT", url: "https://github.com/pmndrs/zustand" },
  { name: "devices.css", what: "The phone frame around the GPS", licence: "MIT", url: "https://github.com/picturepan2/devices.css" },
  { name: "Inter", what: "Typeface", licence: "SIL Open Font License 1.1", url: "https://rsms.me/inter/" },
  { name: "FastAPI, NumPy, SciPy, scikit-image, rasterio, pyproj, GeoPandas", what: "Backend and data pipeline", licence: "MIT / BSD", url: "https://fastapi.tiangolo.com" },
];

export const disclaimer =
  "Independent project. Not affiliated with, endorsed by or sponsored by NASA, USGS, the IAU, IBM or Apple. " +
  "NASA mission data is used as published by its providers; \"iPhone\" is a trademark of Apple Inc., used here only to describe the phone-shaped frame.";
