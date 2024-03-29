# Generated by Django 5.0 on 2024-01-03 09:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("LittleLemonAPI", "0001_initial"),
    ]

    operations = [
        migrations.RemoveField(model_name="menuitem", name="featured",),
        migrations.AddField(
            model_name="menuitem",
            name="inventory",
            field=models.SmallIntegerField(default=0),
            preserve_default=False,
        ),
        migrations.AlterField(
            model_name="menuitem",
            name="price",
            field=models.DecimalField(db_index=True, decimal_places=6, max_digits=6),
        ),
    ]
