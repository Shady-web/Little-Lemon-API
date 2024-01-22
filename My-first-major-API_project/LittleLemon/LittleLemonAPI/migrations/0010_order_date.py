# Generated by Django 5.0 on 2024-01-21 04:58

import datetime
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("LittleLemonAPI", "0009_remove_order_date"),
    ]

    operations = [
        migrations.AddField(
            model_name="order",
            name="date",
            field=models.DateTimeField(
                db_index=True,
                default=datetime.datetime(
                    2024, 1, 21, 4, 58, 51, 335587, tzinfo=datetime.timezone.utc
                ),
            ),
            preserve_default=False,
        ),
    ]
