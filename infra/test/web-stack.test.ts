// Story #100: the web hosting stack (D2, D3, D12, G6, G17, G18).
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { WebStack } from "../src/web-stack.ts";
import { WEB_STACK } from "../src/names.ts";

const template: Template = Template.fromStack(new WebStack(new App(), WEB_STACK));
const json: string = JSON.stringify(template.toJSON());

describe("web hosting stack", () => {
    it("keeps the files in a private bucket (G17)", () => {
        template.resourceCountIs("AWS::S3::Bucket", 1);
        template.hasResourceProperties("AWS::S3::Bucket", {
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
            },
            WebsiteConfiguration: Match.absent(),
        });
    });

    it("lets only this distribution read the bucket, through origin access control (D12, G17)", () => {
        template.resourceCountIs("AWS::CloudFront::OriginAccessControl", 1);
        const policy = Object.values(template.findResources("AWS::S3::BucketPolicy"))[0] as any;
        const allows = (policy.Properties.PolicyDocument.Statement as any[]).filter((s) => s.Effect === "Allow");
        expect(allows).toHaveLength(1);
        expect(allows[0].Principal).toEqual({ Service: "cloudfront.amazonaws.com" });
        expect(allows[0].Action).toBe("s3:GetObject");
        expect(JSON.stringify(allows[0].Condition)).toContain("AWS:SourceArn");
    });

    it("serves the page over HTTPS at the root, with no request logging (D12, G18, G22)", () => {
        template.hasResourceProperties("AWS::CloudFront::Distribution", {
            DistributionConfig: Match.objectLike({
                DefaultRootObject: "index.html",
                Logging: Match.absent(),
                DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: "redirect-to-https" }),
            }),
        });
    });

    it("routes only the static files, with no cross-origin policy of its own (D3, G6)", () => {
        const dist = Object.values(template.findResources("AWS::CloudFront::Distribution"))[0] as any;
        expect(dist.Properties.DistributionConfig.Origins).toHaveLength(1);
        expect(dist.Properties.DistributionConfig.CacheBehaviors).toBeUndefined();
        expect(json).not.toContain("CorsConfig");
        expect(json).not.toContain("lambda-url");
    });

    it("takes no value from the backend stack (D2)", () => {
        expect(json).not.toContain("Fn::ImportValue");
    });

    it("outputs the web view address, the bucket and the distribution", () => {
        template.hasOutput("WebViewUrl", {});
        template.hasOutput("BucketName", {});
        template.hasOutput("DistributionId", {});
    });
});
