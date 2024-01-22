# Generated by Django 5.0 on 2024-01-20 05:34

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("LittleLemonAPI", "0007_alter_cart_unique_together_and_more"),
    ]

    operations = [
        migrations.RemoveField(model_name="orderitems", name="cart",),
        migrations.RemoveField(model_name="orderitems", name="unit_price",),
        migrations.AlterField(
            model_name="order", name="date", field=models.DateField(db_index=True),
        ),
    ]