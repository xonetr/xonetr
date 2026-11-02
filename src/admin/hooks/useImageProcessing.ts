import {useCallback} from "react";
import type {Area} from "react-easy-crop";
import type {ImageCropState,ImageEditorResult} from "../components/image-editor/types";

const TWO_MB=2*1024*1024;

async function orientedBitmap(source:Blob){
  try{return await createImageBitmap(source,{imageOrientation:"from-image"})}
  catch{return createImageBitmap(source)}
}

function canvasBlob(canvas:HTMLCanvasElement,type:string,quality?:number){
  return new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,type,quality));
}

function hasTransparency(context:CanvasRenderingContext2D,width:number,height:number){
  const sample=context.getImageData(0,0,width,height).data;
  for(let index=3;index<sample.length;index+=4)if(sample[index]<250)return true;
  return false;
}

export function useImageProcessing(){
  const inspect=useCallback(async(source:Blob|string)=>{
    const blob=typeof source==="string"?await fetch(source).then(response=>{if(!response.ok)throw new Error("No se pudo leer la imagen original.");return response.blob()}):source;
    const bitmap=await orientedBitmap(blob);
    const result={width:bitmap.width,height:bitmap.height,blob};bitmap.close();return result;
  },[]);

  const process=useCallback(async(source:Blob,cropPixels:Area,state:ImageCropState,maxSize:number|{width:number;height:number},baseName="imagen"):Promise<ImageEditorResult>=>{
    const bitmap=await orientedBitmap(source);
    const radians=state.rotation*Math.PI/180;
    const sin=Math.abs(Math.sin(radians));const cos=Math.abs(Math.cos(radians));
    const boundWidth=Math.ceil(bitmap.width*cos+bitmap.height*sin);const boundHeight=Math.ceil(bitmap.width*sin+bitmap.height*cos);
    const transformed=document.createElement("canvas");transformed.width=boundWidth;transformed.height=boundHeight;
    const transformedContext=transformed.getContext("2d",{willReadFrequently:true});if(!transformedContext)throw new Error("El navegador no pudo preparar la imagen.");
    transformedContext.translate(boundWidth/2,boundHeight/2);transformedContext.rotate(radians);transformedContext.scale(state.flipH?-1:1,state.flipV?-1:1);transformedContext.drawImage(bitmap,-bitmap.width/2,-bitmap.height/2);bitmap.close();
    let outputWidth:number;let outputHeight:number;
    if(typeof maxSize==="number"){
      const scale=Math.min(1,maxSize/Math.max(cropPixels.width,cropPixels.height));outputWidth=Math.max(1,Math.round(cropPixels.width*scale));outputHeight=Math.max(1,Math.round(cropPixels.height*scale));
    }else{outputWidth=maxSize.width;outputHeight=maxSize.height}
    const output=document.createElement("canvas");output.width=outputWidth;output.height=outputHeight;
    const context=output.getContext("2d",{willReadFrequently:true});if(!context)throw new Error("El navegador no pudo exportar la imagen.");
    context.drawImage(transformed,cropPixels.x,cropPixels.y,cropPixels.width,cropPixels.height,0,0,outputWidth,outputHeight);
    const transparent=hasTransparency(context,Math.min(outputWidth,512),Math.min(outputHeight,512));
    let mime=transparent?"image/png":"image/webp";let quality=0.85;let blob=await canvasBlob(output,mime,quality);
    if(!blob&&mime==="image/webp"){mime="image/jpeg";blob=await canvasBlob(output,mime,quality)}
    while(blob&&blob.size>TWO_MB&&(output.width>320||output.height>320)){
      quality=Math.max(.62,quality-.06);const shrink=Math.sqrt(TWO_MB/blob.size)*.94;
      const copy=document.createElement("canvas");copy.width=Math.max(1,Math.round(output.width*Math.min(.9,shrink)));copy.height=Math.max(1,Math.round(output.height*Math.min(.9,shrink)));
      copy.getContext("2d")?.drawImage(output,0,0,copy.width,copy.height);output.width=copy.width;output.height=copy.height;output.getContext("2d")?.drawImage(copy,0,0);blob=await canvasBlob(output,mime,mime==="image/png"?undefined:quality);
    }
    if(!blob||blob.size>TWO_MB)throw new Error("No se pudo mantener el resultado por debajo de 2 MB. Prueba un recorte más pequeño.");
    const extension=mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg";
    const file=new File([blob],`${baseName.replace(/\.[^.]+$/,"")}-editada.${extension}`,{type:mime});
    return{file,metadata:{crop:state,width:output.width,height:output.height,size:file.size,mime}};
  },[]);

  return{inspect,process};
}

