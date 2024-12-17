import * as React from "react";
import "./maskEditor.less";
import { hexToRgb } from "./utils";

export interface MaskEditorProps {
  src: string;
  canvasRef?: React.MutableRefObject<HTMLCanvasElement>;
  cursorSize?: number;
  onCursorSizeChange?: (size: number) => void;
  maskOpacity?: number;
  maskColor?: string;
  maskBlendMode?: "normal"|"multiply"|"screen"|"overlay"|"darken"|"lighten"|"color-dodge"|"color-burn"|"hard-light"|"soft-light"|"difference"|"exclusion"|"hue"|"saturation"|"color"|"luminosity"
}

export const MaskEditorDefaults = {
  cursorSize: 10,
  maskOpacity: .75,
  maskColor: "#23272d",
  maskBlendMode: "normal",
}

export const MaskEditor: React.FC<MaskEditorProps> = (props: MaskEditorProps) => {
  const {
    src,
    cursorSize = MaskEditorDefaults.cursorSize,
    maskColor = MaskEditorDefaults.maskColor,
    maskBlendMode = MaskEditorDefaults.maskBlendMode,
    maskOpacity = MaskEditorDefaults.maskOpacity
  } = props;

  const canvas = React.useRef<HTMLCanvasElement|null>(null);
  const maskCanvas = React.useRef<HTMLCanvasElement|null>(null);
  const cursorCanvas = React.useRef<HTMLCanvasElement|null>(null);

  const [context, setContext] = React.useState<CanvasRenderingContext2D|null>(null);
  const [maskContext, setMaskContext] = React.useState<CanvasRenderingContext2D|null>(null);
  const [cursorContext, setCursorContext] = React.useState<CanvasRenderingContext2D|null>(null);

  const [size, setSize] = React.useState<{x: number, y: number}>({x: 256, y: 256})

  // Inicializa el contexto base
  React.useLayoutEffect(() => {
    if (canvas.current && !context) {
      const ctx = canvas.current.getContext("2d");
      setContext(ctx);
    }
  }, [canvas, context]);

  // Inicializa el contexto de la máscara
  React.useLayoutEffect(() => {
    if (maskCanvas.current && !maskContext) {
      const ctx = maskCanvas.current.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff"; // La máscara inicia blanca
        ctx.fillRect(0, 0, size.x, size.y);
      }
      setMaskContext(ctx);
    }
  }, [maskCanvas, maskContext, size]);

  // Inicializa el contexto del cursor
  React.useLayoutEffect(() => {
    if (cursorCanvas.current && !cursorContext) {
      const ctx = cursorCanvas.current.getContext("2d");
      setCursorContext(ctx);
    }
  }, [cursorCanvas, cursorContext]);

  // Carga la imagen base
  React.useEffect(() => {
    if (src && context) {
      const img = new Image();
      img.onload = () => {
        setSize({x: img.width, y: img.height});
        context.clearRect(0, 0, img.width, img.height);
        context.drawImage(img, 0, 0);
      }
      img.crossOrigin = "Anonymous";
      img.src = src;
    }
  }, [src, context]);

  // Pasa el maskCanvas hacia afuera
  React.useLayoutEffect(() => {
    if (props.canvasRef) {
      props.canvasRef.current = maskCanvas.current;
    }
  }, [maskCanvas, props.canvasRef]);

  // Evento para dibujar y actualizar el cursor
  React.useEffect(() => {
    const handleMouseMove = (evt: MouseEvent) => {
      if (!cursorContext || !maskContext) return;

      // Limpia el canvas del cursor
      cursorContext.clearRect(0, 0, size.x, size.y);

      // Dibuja el cursor
      cursorContext.beginPath();
      cursorContext.fillStyle = `${maskColor}88`;
      cursorContext.strokeStyle = maskColor;
      cursorContext.arc(evt.offsetX, evt.offsetY, cursorSize, 0, Math.PI * 2);
      cursorContext.fill();
      cursorContext.stroke();

      // Si se está presionando un botón del ratón, pinta en el maskCanvas
      if (evt.buttons > 0) {
        maskContext.beginPath();
        // Usar otro color si es botón secundario o shift, si así se desea
        maskContext.fillStyle = (evt.buttons > 1 || evt.shiftKey) ? "#ffffff" : maskColor;
        maskContext.arc(evt.offsetX, evt.offsetY, cursorSize, 0, Math.PI * 2);
        maskContext.fill();
      }
    };

    const handleWheel = (evt: WheelEvent) => {
      if (!cursorContext || !maskContext || !props.onCursorSizeChange) return;

      const newSize = Math.max(1, cursorSize + (evt.deltaY > 0 ? 1 : -1));
      props.onCursorSizeChange(newSize);

      cursorContext.clearRect(0, 0, size.x, size.y);
      cursorContext.beginPath();
      cursorContext.fillStyle = `${maskColor}88`;
      cursorContext.strokeStyle = maskColor;
      cursorContext.arc(evt.offsetX, evt.offsetY, newSize, 0, Math.PI * 2);
      cursorContext.fill();
      cursorContext.stroke();

      evt.stopPropagation();
      evt.preventDefault();
    };

    const cnv = cursorCanvas.current;
    cnv?.addEventListener("mousemove", handleMouseMove);
    if (props.onCursorSizeChange) {
      cnv?.addEventListener("wheel", handleWheel, { passive: false });
    }

    return () => {
      cnv?.removeEventListener("mousemove", handleMouseMove);
      if (props.onCursorSizeChange) {
        cnv?.removeEventListener("wheel", handleWheel);
      }
    };
  }, [cursorContext, maskContext, cursorCanvas, cursorSize, maskColor, size, props]);

  // Ajustar la máscara cuando cambie el color
  const replaceMaskColor = React.useCallback((hexColor: string, invert: boolean) => {
    if (!maskContext) return;
    const imageData = maskContext.getImageData(0, 0, size.x, size.y);
    const color = hexToRgb(hexColor);
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixelColor = ((imageData.data[i] === 255) !== invert) ? [255, 255, 255] : color;
      imageData.data[i] = pixelColor[0];
      imageData.data[i + 1] = pixelColor[1];
      imageData.data[i + 2] = pixelColor[2];
      // Alfa permanece igual
    }
    maskContext.putImageData(imageData, 0, 0);
  }, [maskContext, size]);

  React.useEffect(() => {
    replaceMaskColor(maskColor, false);
  }, [maskColor, replaceMaskColor]);

  return (
    <div className="react-mask-editor-outer">
      <div
        className="react-mask-editor-inner"
        style={{
          width: size.x,
          height: size.y,
        }}
      >
        <div className="all-canvases" style={{ position: "relative", width: size.x, height: size.y }}>
          <canvas
            ref={canvas}
            style={{
              width: size.x,
              height: size.y,
              zIndex: 1,
            }}
            width={size.x}
            height={size.y}
            className="react-mask-editor-base-canvas"
          />
          <canvas
            ref={maskCanvas}
            width={size.x}
            height={size.y}
            style={{
              width: size.x,
              height: size.y,
              opacity: maskOpacity,
              mixBlendMode: maskBlendMode as any,
              zIndex: 10,
            }}
            className="react-mask-editor-mask-canvas" // Asegúrate que esta clase se corresponda con .mask-canvas en el LESS, o ajusta el LESS.
          />
          <canvas
            ref={cursorCanvas}
            width={size.x}
            height={size.y}
            style={{
              width: size.x,
              height: size.y,
              zIndex: 20,
            }}
            className="react-mask-editor-cursor-canvas" // Asegúrate que esta clase se corresponda con .cursor-canvas en el LESS, o ajusta el LESS.
          />
        </div>
      </div>
    </div>
  );
}
