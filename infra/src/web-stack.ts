// The web hosting stack: a private bucket and the CloudFront distribution in front of it (D2,
// D12). It routes only the static files; the web view calls the backend at its own address (D3).
// It takes no value from the backend stack.
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import {
    CacheCookieBehavior,
    CacheHeaderBehavior,
    CachePolicy,
    CacheQueryStringBehavior,
    Distribution,
    ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export class WebStack extends Stack {
    constructor(scope: Construct, id: string, props: StackProps = {}) {
        super(scope, id, props);

        // No public access and no website hosting: only the distribution reads the files (G17).
        const bucket: Bucket = new Bucket(this, "Files", {
            blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
            encryption: BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: RemovalPolicy.RETAIN,
        });

        // The edge keeps each file until the next deploy's invalidation. A file's own "no-cache"
        // header still reaches the browser, which revalidates on each load (D11). CloudFront
        // caches a "no-cache" answer for the minimum TTL, so the minimum is the long one.
        const year: Duration = Duration.days(365);
        const cachePolicy: CachePolicy = new CachePolicy(this, "CacheUntilDeploy", {
            comment: "Raiden web view: kept at the edge until the next deploy's invalidation",
            minTtl: year,
            defaultTtl: year,
            maxTtl: year,
            queryStringBehavior: CacheQueryStringBehavior.none(),
            headerBehavior: CacheHeaderBehavior.none(),
            cookieBehavior: CacheCookieBehavior.none(),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
        });

        // HTTPS on CloudFront's own address, the page at the root, and no request logging, so the
        // sign-in return address and its one-time code are written to no log (G18, G22).
        const distribution: Distribution = new Distribution(this, "Distribution", {
            comment: "Raiden web view",
            defaultRootObject: "index.html",
            enableLogging: false,
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy,
            },
        });

        new CfnOutput(this, "WebViewUrl", { value: `https://${distribution.distributionDomainName}/` });
        new CfnOutput(this, "BucketName", { value: bucket.bucketName });
        new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    }
}
