import * as cdk from "aws-cdk-lib";
import * as ec2  from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";

export class BlogStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── Key pair name ───────────────────────────────────────────
    // Create a key pair in the AWS console (EC2 → Key Pairs) before deploying,
    // then pass its name here or via: cdk deploy --context keyPairName=your-key
    const keyPairName = this.node.tryGetContext("keyPairName") ?? "blog-key";

    // ── VPC ─────────────────────────────────────────────────────
    // Use the default VPC to keep things simple and avoid extra cost
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    // ── Security group (firewall) ────────────────────────────────
    const sg = new ec2.SecurityGroup(this, "BlogSG", {
      vpc,
      securityGroupName: "blog-sg",
      description: "Blog server - allow SSH, HTTP, HTTPS",
      allowAllOutbound: true,
    });

    // SSH — restrict to your IP in production:
    //   sg.addIngressRule(ec2.Peer.ipv4("YOUR.IP.HERE/32"), ec2.Port.tcp(22), "SSH from my IP");
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22),  "SSH");
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80),  "HTTP");
    sg.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(443), "HTTPS");

    // ── User data — runs once on first boot ──────────────────────
    // Installs Docker and Docker Compose v2 on Amazon Linux 2023
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "dnf update -y",
      "dnf install -y docker git nginx",
      "systemctl enable nginx",
      "systemctl start nginx",
      "systemctl enable docker",
      "systemctl start docker",
      // Allow ec2-user to run docker without sudo
      "usermod -aG docker ec2-user",
      // Docker Compose v2 plugin
      "mkdir -p /usr/local/lib/docker/cli-plugins",
      "curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose",
      "chmod +x /usr/local/lib/docker/cli-plugins/docker-compose",
      // Docker Buildx plugin (required by compose build)
      "mkdir -p /root/.docker/cli-plugins",
      "curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 -o /root/.docker/cli-plugins/docker-buildx",
      "chmod +x /root/.docker/cli-plugins/docker-buildx",
      // Also install for ec2-user
      "mkdir -p /home/ec2-user/.docker/cli-plugins",
      "curl -SL https://github.com/docker/buildx/releases/download/v0.19.3/buildx-v0.19.3.linux-amd64 -o /home/ec2-user/.docker/cli-plugins/docker-buildx",
      "chmod +x /home/ec2-user/.docker/cli-plugins/docker-buildx",
      "chown -R ec2-user:ec2-user /home/ec2-user/.docker",
      // fail2ban — blocks IPs with repeated SSH login failures
      "dnf install -y fail2ban",
      "printf '[DEFAULT]\\nbantime  = 1h\\nfindtime = 10m\\nmaxretry = 5\\nbackend  = systemd\\n\\n[sshd]\\nenabled = true\\n' > /etc/fail2ban/jail.local",
      "systemctl enable fail2ban",
      "systemctl start fail2ban",
    );

    // ── EC2 instance ─────────────────────────────────────────────
    // t3.micro: 1 vCPU, 1 GB RAM — ~$8.50/month (free tier eligible)
    // Upgrade to t3.small (2 GB, ~$17/month) if memory becomes an issue
    const instance = new ec2.Instance(this, "BlogInstance", {
      vpc,
      instanceType:  ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage:  ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup: sg,
      keyName:       keyPairName,
      userData,
      // 20 GB root volume — enough for the app, Docker images, and DB data
      blockDevices: [{
        deviceName: "/dev/xvda",
        volume:     ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3 }),
      }],
    });

    // ── Elastic IP ───────────────────────────────────────────────
    // Ensures the public IP stays the same across reboots
    const eip = new ec2.CfnEIP(this, "BlogEIP", {
      instanceId: instance.instanceId,
      tags: [{ key: "Name", value: "blog-eip" }],
    });

    // ── Outputs ──────────────────────────────────────────────────
    new cdk.CfnOutput(this, "PublicIP", {
      value:       eip.ref,
      description: "Public IP of the blog server — point your domain here",
    });

    new cdk.CfnOutput(this, "SSHCommand", {
      value:       `ssh -i ~/.ssh/${keyPairName}.pem ec2-user@${eip.ref}`,
      description: "SSH command to connect to the server",
    });

    new cdk.CfnOutput(this, "InstanceId", {
      value:       instance.instanceId,
      description: "EC2 instance ID",
    });
  }
}
