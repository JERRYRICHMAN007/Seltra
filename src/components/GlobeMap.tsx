const FRAMER_GLOBE_BUNDLE = "https://framerusercontent.com/modules/3S8YXL7d55MyaEPZ2DfN/rpqp20ugovX8JEbvoUoT/GlobeMorph.js";

const SRC = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>
      html,body { height:100%; margin:0; padding:0; background:transparent; overflow:hidden; }
      #root { width:100%; height:100%; overflow:hidden; }
      /* Hide any scrollbars inside the embed */
      ::-webkit-scrollbar { display: none; }
    </style>
    <script type="importmap">{
      "imports": {
        "react": "https://esm.sh/react@18?min",
        "react/jsx-runtime": "https://esm.sh/react@18/jsx-runtime?min",
        "react/jsx-dev-runtime": "https://esm.sh/react@18/jsx-dev-runtime?min",
        "react-dom/client": "https://esm.sh/react-dom@18/client?min",
        "framer": "/framer-shim.js"
      }
    }</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module">
      import * as React from 'react';
      import { createRoot } from 'react-dom/client';
      try {
        // Load the Framer bundle and mount the component. The embed will control its own layout.
        const module = await import('${FRAMER_GLOBE_BUNDLE}');
        const Component = module.default || module.GlobeMorph || null;
        const root = createRoot(document.getElementById('root'));
        if (Component) root.render(React.createElement(Component, { style: { width: '100%', height: '100%' } }));
      } catch (err) {
        console.error(err);
        document.body.innerHTML = '<div style="color:#fff;background:#000;padding:20px;font-family:sans-serif;">Failed to load GlobeMorph.</div>';
      }
    </script>
  </body>
</html>`;

export default function GlobeMap() {
  return (
    <div className="relative h-[40vh] md:h-[60vh] lg:h-[70vh] overflow-hidden">
      <iframe
        title="Globe Morph"
        srcDoc={SRC}
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
        scrolling="no"
        className="absolute inset-0 w-full h-full"
        style={{ border: 'none', display: 'block' }}
      />
    </div>
  );
}
