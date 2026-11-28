// The web hosting stack: a private bucket and the CloudFront distribution in front of it (D2,
// D12). It routes only the static files; the web view calls the backend at its own address (D3).
// It takes no value from the backend stack.
import { CfnOutput, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import { CachePolicy, Distribution, ViewerProtocolPolicy } from "aws-cdk-lib/aws-cloudfront";
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

        // HTTPS on CloudFront's own address, the page at the root, and no request logging, so the
        // sign-in return address and its one-time code are written to no log (G18, G22).
        const distribution: Distribution = new Distribution(this, "Distribution", {
            comment: "Raiden web view",
            defaultRootObject: "index.html",
            enableLogging: false,
            defaultBehavior: {
                origin: S3BucketOrigin.withOriginAccessControl(bucket),
                viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                cachePolicy: CachePolicy.CACHING_OPTIMIZED,
            },
        });

        new CfnOutput(this, "WebViewUrl", { value: `https://${distribution.distributionDomainName}/` });
        new CfnOutput(this, "BucketName", { value: bucket.bucketName });
        new CfnOutput(this, "DistributionId", { value: distribution.distributionId });
    }
}
