// This will allow you to import .png files
declare module "*.png" {
  const content: string;
  export default content;
}

// Similarly, for other image file types, add:
declare module "*.jpg" {
  const content: string;
  export default content;
}

declare module "*.jpeg" {
  const content: string;
  export default content;
}

declare module "*.gif" {
  const content: string;
  export default content;
}

declare module "*.svg" {
  const content: string;
  export default content;
}
