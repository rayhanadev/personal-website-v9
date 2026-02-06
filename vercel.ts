import { type VercelConfig, routes } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "astro",
  redirects: [
    routes.redirect("/resume", "/resume.pdf", { permanent: true }),
    routes.redirect("/contact", "/contact.vcf", { permanent: true }),
    routes.redirect("/rss.xml", "https://rayhanadev.substack.com/feed"),
    routes.redirect("/blog", "https://substack.com/@rayhanadev"),
   ],
   headers: [
     routes.cacheControl('/static/(.*)', {
       public: true,
       maxAge: '1 year',
       immutable: true
     }),
     routes.cacheControl('/_server-islands/(.*)', {
       public: true,
       maxAge: '1 hour',
       staleWhileRevalidate: '1 day'
     }),
   ],
};
