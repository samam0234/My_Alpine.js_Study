from django.db import migrations, models


def seed(apps, schema_editor):
    Post = apps.get_model('posts', 'Post')
    Post.objects.bulk_create([
        Post(title='첫 글', body='Django 템플릿이 그린 글'),
        Post(title='둘째 글', body='HTMX가 목록만 바꾼다'),
    ])


class Migration(migrations.Migration):
    initial = True
    dependencies = []
    operations = [
        migrations.CreateModel(
            name='Post',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('body', models.TextField()),
            ],
        ),
        migrations.RunPython(seed, migrations.RunPython.noop),
    ]
