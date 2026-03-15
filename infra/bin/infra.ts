#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { BlogStack } from "../lib/blog-stack";

const app = new cdk.App();

new BlogStack(app, "BlogStack", {
  // Set your AWS account and region here, or use environment variables:
  // AWS_ACCOUNT and AWS_DEFAULT_REGION
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region:  process.env.CDK_DEFAULT_REGION ?? "ap-southeast-2",
  },
  description: "Brendan's Blog — EC2 server infrastructure",
});
