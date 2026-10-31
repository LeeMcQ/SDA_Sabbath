#!/usr/bin/env python3
"""Teach the translator church language: fine-tune OPUS-MT af-en on the Afrikaans 1933/53 Bible paired verse by verse
with the World English Bible (both public domain, about 30,000 pairs from SDA Sabbath's own data).

Run where there is a graphics card (free: Google Colab or Kaggle, about 20 minutes):
    pip install transformers sentencepiece sacremoses sacrebleu ctranslate2 torch
    python finetune_mt.py
It prints the translation score on 1,000 held-back verses before and after, and writes models/opus-mt-af-en-sda,
which livetranslate.py then prefers. Check it on a real sermon too (bench --mt models/opus-mt-af-en-sda versus
--mt models/opus-mt-af-en): use it only if the sermon reads better. A gentle learning rate and one pass keep the
model's everyday Afrikaans; the World English Bible (not King James) keeps the English modern.
"""
import json, os, random, sys
from livetranslate import lord

HERE = os.path.dirname(os.path.abspath(__file__))
from livetranslate import BIBLES  # translator/bibles in the download, else ../data/bibles
OUT = os.path.join(HERE, 'models', 'opus-mt-af-en-sda')
BASE = 'Helsinki-NLP/opus-mt-af-en'
PSALMS = 19     # Afrikaans psalm headings are counted as verses, so its verse numbers do not line up: left out


def pairs():
    out = []
    for b in range(1, 67):
        if b == PSALMS:
            continue
        af = json.load(open(os.path.join(BIBLES, 'afr53', '%02d.json' % b), encoding='utf-8'))
        en = json.load(open(os.path.join(BIBLES, 'web', '%02d.json' % b), encoding='utf-8'))
        for ca, ce in zip(af, en):
            if len(ca) != len(ce):          # a chapter that is divided differently: skip rather than mispair
                continue
            for a, e in zip(ca, ce):
                a, e = a.strip(), lord(e.strip())
                if a and e and 0.5 < len(a) / len(e) < 2.0 and len(a) < 600:
                    out.append((a, e))
    return out


def main():
    import torch, sacrebleu
    from transformers import MarianMTModel, MarianTokenizer, Seq2SeqTrainer, Seq2SeqTrainingArguments, DataCollatorForSeq2Seq
    data = pairs()
    random.Random(7).shuffle(data)
    test, train = data[:1000], data[1000:]
    print('%d training pairs, %d held back' % (len(train), len(test)))
    tok = MarianTokenizer.from_pretrained(BASE)
    model = MarianMTModel.from_pretrained(BASE)
    dev = 'cuda' if torch.cuda.is_available() else 'cpu'

    def score(m):
        m.to(dev).eval(); hyps = []
        for i in range(0, len(test), 32):
            batch = tok([a for a, _ in test[i:i + 32]], return_tensors='pt', padding=True, truncation=True, max_length=256).to(dev)
            with torch.no_grad():
                gen = m.generate(**batch, num_beams=4, max_length=256)
            hyps += tok.batch_decode(gen, skip_special_tokens=True)
        return sacrebleu.corpus_bleu(hyps, [[e for _, e in test]]).score

    before = score(model)
    print('BLEU before: %.1f' % before)

    class DS(torch.utils.data.Dataset):
        def __init__(self, rows): self.rows = rows
        def __len__(self): return len(self.rows)
        def __getitem__(self, i):
            a, e = self.rows[i]
            x = tok(a, truncation=True, max_length=256)
            x['labels'] = tok(text_target=e, truncation=True, max_length=256)['input_ids']
            return x

    args = Seq2SeqTrainingArguments(output_dir=os.path.join(HERE, 'models', 'ft-tmp'), per_device_train_batch_size=32,
                                    learning_rate=2e-5, num_train_epochs=1, warmup_ratio=0.05, weight_decay=0.01,
                                    fp16=dev == 'cuda', save_strategy='no', logging_steps=100, report_to=[])
    Seq2SeqTrainer(model=model, args=args, train_dataset=DS(train), data_collator=DataCollatorForSeq2Seq(tok, model)).train()
    after = score(model)
    print('BLEU after:  %.1f' % after)
    if after <= before:
        sys.exit('No improvement: keeping the original model.')
    tmp = os.path.join(HERE, 'models', 'ft-hf')
    model.save_pretrained(tmp); tok.save_pretrained(tmp)
    import ctranslate2
    ctranslate2.converters.TransformersConverter(tmp, copy_files=['source.spm', 'target.spm']).convert(OUT, quantization='int8', force=True)
    print('Saved', OUT)


if __name__ == '__main__':
    main()
