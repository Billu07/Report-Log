import { createUploadthing, type FileRouter } from "uploadthing/next";

const f = createUploadthing();

export const ourFileRouter = {
  imageUploader: f({ image: { maxFileSize: "4MB" } })
    .middleware(async () => {
      console.log("UploadThing: Checking environment variables...");
      const hasSecret = !!process.env.UPLOADTHING_SECRET;
      const hasAppId = !!process.env.UPLOADTHING_APP_ID;
      console.log("UploadThing: Secret Present:", hasSecret, "AppID Present:", hasAppId);
      
      if (!hasSecret || !hasAppId) {
        throw new Error("Missing UploadThing environment variables");
      }
      
      return { };
    })
    .onUploadComplete(async ({ file }) => {
      console.log("UploadThing: Upload complete", file.url);
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
