export type AspectOption={label:string;value:number|null};

export type ImageCropState={
  crop:{x:number;y:number};
  zoom:number;
  rotation:number;
  flipH:boolean;
  flipV:boolean;
  aspect:number|null;
  area?:{x:number;y:number;width:number;height:number};
};

export type ImageEditMetadata={
  original:string;
  crop:ImageCropState;
  width:number;
  height:number;
  size:number;
  mime:string;
};

export type ImageEditorResult={file:File;metadata:Omit<ImageEditMetadata,"original">};

