import threading
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.conf import settings


def _send_welcome_email(user_email, username, first_name):
    name = first_name or username
    site_url = getattr(settings, 'SITE_URL', '')
    subject = 'Welcome to Little Lemon! 🍋'

    text_body = (
        f"Hi {name},\n\n"
        "Welcome to Little Lemon — we're so glad you joined our table!\n\n"
        "You can browse our menu, add items to your cart, and place orders anytime.\n\n"
        f"Visit us at: {site_url}\n\n"
        "Warm regards,\n"
        "The Little Lemon Team"
    )

    html_body = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Little Lemon</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#495E57;padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:36px;font-weight:700;color:#F4CE14;letter-spacing:1px;">🍋 Little Lemon</p>
              <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.8);">A family-owned Mediterranean restaurant</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <h1 style="margin:0 0 16px;font-size:26px;color:#1E1E1E;">Welcome, {name}! 🎉</h1>
              <p style="margin:0 0 16px;font-size:16px;color:#555555;line-height:1.7;">
                We're so happy you joined the Little Lemon family. Your account is ready — you can start exploring our Mediterranean menu right away.
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#555555;line-height:1.7;">
                From fresh grilled fish to homemade baklava, every dish is prepared with love and traditional recipes passed down through generations.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="background:#F4CE14;border-radius:8px;text-align:center;">
                    <a href="{site_url}/menu"
                       style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:600;color:#1E1E1E;text-decoration:none;border-radius:8px;">
                      Browse Our Menu →
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #E5E7EB;margin:0 0 28px;">

              <!-- Features -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="33%" style="text-align:center;padding:0 8px 16px;">
                    <p style="font-size:28px;margin:0 0 8px;">🥗</p>
                    <p style="margin:0;font-size:13px;font-weight:600;color:#333;">Fresh Ingredients</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#888;">Locally sourced daily</p>
                  </td>
                  <td width="33%" style="text-align:center;padding:0 8px 16px;">
                    <p style="font-size:28px;margin:0 0 8px;">🚚</p>
                    <p style="margin:0;font-size:13px;font-weight:600;color:#333;">Fast Delivery</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#888;">Right to your door</p>
                  </td>
                  <td width="33%" style="text-align:center;padding:0 8px 16px;">
                    <p style="font-size:28px;margin:0 0 8px;">❤️</p>
                    <p style="margin:0;font-size:13px;font-weight:600;color:#333;">Made with Love</p>
                    <p style="margin:4px 0 0;font-size:12px;color:#888;">Traditional recipes</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9f9f9;padding:24px 40px;text-align:center;border-top:1px solid #E5E7EB;">
              <p style="margin:0 0 8px;font-size:13px;color:#888888;">
                Questions? Just reply to this email — we're always happy to help.
              </p>
              <p style="margin:0;font-size:12px;color:#aaaaaa;">
                © Little Lemon Restaurant &nbsp;·&nbsp;
                <a href="{site_url}" style="color:#495E57;text-decoration:none;">Visit our site</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    try:
        send_mail(
            subject=subject,
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user_email],
            html_message=html_body,
            fail_silently=False,
        )
    except Exception as e:
        print(f"[email] welcome mail failed for {user_email}: {e}")


@receiver(post_save, sender=User)
def send_welcome_email(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.email:
        return
    # Skip system/superuser accounts created via manage.py
    if instance.is_superuser:
        return

    t = threading.Thread(
        target=_send_welcome_email,
        args=(instance.email, instance.username, instance.first_name),
        daemon=True,
    )
    t.start()
