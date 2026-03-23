-- purchase_accounts 테이블에 알림 연락처 컬럼 추가
ALTER TABLE purchase_accounts
  ADD COLUMN notification_phone varchar(20);

-- sms_logs 테이블의 message_type CHECK 제약조건에 'purchase_notify' 추가
ALTER TABLE sms_logs
  DROP CONSTRAINT IF EXISTS sms_logs_message_type_check;

ALTER TABLE sms_logs
  ADD CONSTRAINT sms_logs_message_type_check
  CHECK (message_type IN ('purchase', 'reissue', 'gift', 'cancel', 'admin_resend', 'purchase_notify'));
