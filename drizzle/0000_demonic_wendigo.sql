CREATE TABLE "chat" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "chat_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"title" text NOT NULL,
	"author_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "message_attachment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"author_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"description" text,
	"file_path" text NOT NULL,
	"file_name" text NOT NULL,
	"url" text,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_attachment_joint" (
	"message_id" integer NOT NULL,
	"attachment_id" integer NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_attachment_joint_message_id_attachment_id_pk" PRIMARY KEY("message_id","attachment_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "messages_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"chat_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"message" text NOT NULL,
	"reply" text NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "email_verification_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"tokenHash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_employee" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "org_employee_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'employee' NOT NULL,
	"password" text NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_employee_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "password_reset_token" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "password_reset_token_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"tokenHash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "refresh_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"tokenHash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"replacedBy" integer
);
--> statement-breakpoint
CREATE TABLE "app_logs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "app_logs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"action" text NOT NULL,
	"user_id" integer NOT NULL,
	"user_name" text NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"updated_time" timestamp with time zone,
	"created_time" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_author_id_org_employee_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment" ADD CONSTRAINT "message_attachment_author_id_org_employee_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment_joint" ADD CONSTRAINT "message_attachment_joint_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_attachment_joint" ADD CONSTRAINT "message_attachment_joint_attachment_id_message_attachment_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."message_attachment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_org_employee_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_token" ADD CONSTRAINT "email_verification_token_user_id_org_employee_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_token" ADD CONSTRAINT "password_reset_token_user_id_org_employee_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_org_employee_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replacedBy_refresh_tokens_id_fk" FOREIGN KEY ("replacedBy") REFERENCES "public"."refresh_tokens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_logs" ADD CONSTRAINT "app_logs_user_id_org_employee_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."org_employee"("id") ON DELETE no action ON UPDATE no action;